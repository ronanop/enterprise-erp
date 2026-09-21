"""Automated order / delivery correspondence for CRM-sourced vendor POs.

Three messages come off one scheduled pass, so nobody chases dates by hand:

1. **Order acknowledgement** to the customer once the PO is issued - their order
   is placed and we are waiting on the delivery date.
2. **ETD chase** to the distributor every ``ETD_REMINDER_INTERVAL_DAYS`` until an
   expected delivery date is on the PO.
3. **Delivery update** to the customer whenever that ETD is set or changes.

Recipients are resolved best-effort; an order with no address is skipped rather
than failing the whole run.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.notification_service import NotificationService
from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter
from modules.procurement.adapters.master_data_adapter import ProcurementMasterDataAdapter
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.models.order import ProcOrderHeader
from modules.procurement.repository.base import utcnow
from modules.procurement.service.procurement_scope_validator import ProcurementScopeValidator

# How often the distributor is chased for a delivery date.
ETD_REMINDER_INTERVAL_DAYS = 10

# Statuses where the PO is live with the distributor and worth chasing.
_LIVE_STATUSES = (
    OrderStatus.SENT.value,
    OrderStatus.APPROVED.value,
    OrderStatus.PARTIALLY_RECEIVED.value,
)

_SOURCE_MODULE = "crm"
_SOURCE_DOC_TYPE = "ovf"


def _html(paragraphs: list[str]) -> str:
    body = "".join(f"<p>{line}</p>" for line in paragraphs)
    return f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">{body}</div>'


class ScmDeliveryNotificationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._crm = ProcurementCrmAdapter(db)
        self._master = ProcurementMasterDataAdapter(db)
        self._notifications = NotificationService(db)
        self._scope = ProcurementScopeValidator(db)

    # -- recipients --------------------------------------------------------
    def _customer_contact(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, Any]:
        """Customer name / email behind an OVF, resolved through the CRM port."""
        try:
            return self._crm.get_customer_contact(ctx, ovf_id)
        except (NotFoundException, ConflictException):
            return {}

    def _vendor_contact(self, ctx: TenantContext, vendor_id: UUID) -> dict[str, Any]:
        try:
            vendor = self._master.get_vendor(ctx, vendor_id)
        except (NotFoundException, ConflictException):
            return {}
        return {
            "email": (getattr(vendor, "email", None) or "").strip() or None,
            "vendor_name": getattr(vendor, "vendor_name", None),
        }

    # -- individual messages ----------------------------------------------
    def _send(
        self,
        ctx: TenantContext,
        *,
        to_address: str,
        subject: str,
        paragraphs: list[str],
        event_type: str,
        order: ProcOrderHeader,
    ) -> None:
        self._notifications.send_email(
            tenant_id=ctx.tenant_id,
            to_address=to_address,
            subject=subject,
            body_html=_html(paragraphs),
            event_type=event_type,
            payload_json={
                "order_id": str(order.id),
                "company_po_number": order.company_po_number,
            },
            created_by=ctx.user_id,
        )

    def _order_reference(self, customer: dict[str, Any], order: ProcOrderHeader) -> str:
        return (
            customer.get("po_number")
            or order.company_po_number
            or order.document_number
        )

    def acknowledge_order(
        self, ctx: TenantContext, order: ProcOrderHeader, customer: dict[str, Any]
    ) -> bool:
        """Tell the customer their order is placed and an ETD is being chased."""
        to_address = customer.get("email")
        if not to_address:
            return False
        reference = self._order_reference(customer, order)
        self._send(
            ctx,
            to_address=to_address,
            subject=f"Your order {reference} has been placed",
            paragraphs=[
                f"Dear {customer.get('customer_name') or 'Customer'},",
                f"Your order against PO <strong>{reference}</strong> has been executed and "
                "placed with our supply partner.",
                "We are waiting on the confirmed delivery date and will share it as soon as "
                "we have it. You will hear from us at least 7 to 10 days before the material "
                "reaches you.",
                "Thank you for your business.",
            ],
            event_type="procurement.order_acknowledged",
            order=order,
        )
        order.customer_ack_sent_at = utcnow()
        return True

    def chase_etd(
        self, ctx: TenantContext, order: ProcOrderHeader, vendor: dict[str, Any]
    ) -> bool:
        """Ask the distributor for the expected delivery date."""
        to_address = vendor.get("email")
        if not to_address:
            return False
        reference = order.company_po_number or order.document_number
        self._send(
            ctx,
            to_address=to_address,
            subject=f"Expected delivery date required - PO {reference}",
            paragraphs=[
                f"Dear {vendor.get('vendor_name') or 'Partner'},",
                f"We have not yet received an expected delivery date for PO "
                f"<strong>{reference}</strong> dated {order.document_date}.",
                "Please confirm the ETD at the earliest so we can plan the onward "
                "delivery with our customer.",
            ],
            event_type="procurement.etd_reminder",
            order=order,
        )
        order.etd_reminder_last_sent_at = utcnow()
        return True

    def share_delivery_date(
        self, ctx: TenantContext, order: ProcOrderHeader, customer: dict[str, Any]
    ) -> bool:
        """Tell the customer the expected delivery date we now hold."""
        to_address = customer.get("email")
        etd = order.expected_delivery_date
        if not to_address or etd is None:
            return False
        reference = self._order_reference(customer, order)
        self._send(
            ctx,
            to_address=to_address,
            subject=f"Expected delivery date for order {reference}",
            paragraphs=[
                f"Dear {customer.get('customer_name') or 'Customer'},",
                f"The material against PO <strong>{reference}</strong> is expected with us "
                f"by <strong>{etd}</strong>.",
                "We will confirm the dispatch plan once the material reaches our warehouse.",
            ],
            event_type="procurement.delivery_date_shared",
            order=order,
        )
        order.etd_customer_notified_for = etd
        return True

    # -- scheduled pass ----------------------------------------------------
    def _live_orders(self, tenant_id: UUID) -> list[ProcOrderHeader]:
        stmt = select(ProcOrderHeader).where(
            ProcOrderHeader.tenant_id == tenant_id,
            ProcOrderHeader.is_deleted.is_(False),
            ProcOrderHeader.status.in_(_LIVE_STATUSES),
            ProcOrderHeader.source_module == _SOURCE_MODULE,
            ProcOrderHeader.source_document_type == _SOURCE_DOC_TYPE,
            ProcOrderHeader.source_document_id.is_not(None),
        )
        return list(self._db.scalars(stmt).all())

    def run(self, ctx: TenantContext, *, now: datetime | None = None) -> dict[str, int]:
        """One pass over live vendor POs. Safe to run repeatedly."""
        moment = now or datetime.now(timezone.utc)
        cutoff = moment - timedelta(days=ETD_REMINDER_INTERVAL_DAYS)
        counts = {"acknowledged": 0, "etd_chased": 0, "delivery_dates_shared": 0}

        for order in self._live_orders(ctx.tenant_id):
            customer = self._customer_contact(ctx, order.source_document_id)

            if order.customer_ack_sent_at is None:
                if self.acknowledge_order(ctx, order, customer):
                    counts["acknowledged"] += 1

            if order.expected_delivery_date is None:
                last = order.etd_reminder_last_sent_at
                if last is None or last <= cutoff:
                    vendor = self._vendor_contact(ctx, order.vendor_id)
                    if self.chase_etd(ctx, order, vendor):
                        counts["etd_chased"] += 1
            elif order.etd_customer_notified_for != order.expected_delivery_date:
                if self.share_delivery_date(ctx, order, customer):
                    counts["delivery_dates_shared"] += 1

        self._db.flush()
        return counts

    # -- ETD maintenance ---------------------------------------------------
    def set_expected_delivery_date(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        expected_delivery_date: date | None,
        notify_customer: bool = True,
    ) -> dict[str, Any]:
        """Record the ETD the distributor confirmed and optionally tell the customer."""
        order = self._db.get(ProcOrderHeader, order_id)
        if order is None or order.is_deleted or order.tenant_id != ctx.tenant_id:
            raise NotFoundException("Purchase order not found")
        self._scope.validate_company_access(ctx, order.company_id)

        order.expected_delivery_date = expected_delivery_date
        order.etd_confirmed_at = utcnow() if expected_delivery_date else None
        order.updated_by = ctx.user_id
        self._db.flush()

        notified = False
        if expected_delivery_date and notify_customer and order.source_document_id:
            customer = self._customer_contact(ctx, order.source_document_id)
            notified = self.share_delivery_date(ctx, order, customer)
            self._db.flush()

        return {
            "order_id": order.id,
            "expected_delivery_date": order.expected_delivery_date,
            "etd_confirmed_at": order.etd_confirmed_at,
            "customer_notified": notified,
        }
