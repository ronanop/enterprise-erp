"""Automated order / delivery correspondence for CRM-sourced vendor POs.

Three messages come off one scheduled pass, so nobody chases dates by hand:

1. **Order acknowledgement** to the customer once the PO is issued — includes the
   expected delivery date (ETD) when known (or \"to be confirmed\").
2. **ETD chase** to the distributor every ``ETD_REMINDER_INTERVAL_DAYS`` until an
   expected delivery date is on the PO.
3. **Delivery update** to the customer whenever that ETD is set or changes.

Recipients are resolved best-effort; an order with no address is skipped rather
than failing the whole run.

Bodies are driven by ``foundation.ntf_template`` rows so SCM can edit defaults
and per-customer overrides from the Delivery Tracking UI.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import ConflictException, NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.notification import NtfDelivery
from modules.foundation.repository.notification_repository import NotificationRepository
from modules.foundation.service.engines.email_delivery_engine import render_template
from modules.foundation.service.notification_service import NotificationService
from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter
from modules.procurement.adapters.master_data_adapter import ProcurementMasterDataAdapter
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.models.order import ProcOrderHeader
from modules.procurement.repository.base import utcnow
from modules.procurement.service.procurement_scope_validator import ProcurementScopeValidator

# How often the distributor is chased for a delivery date.
ETD_REMINDER_INTERVAL_DAYS = 10

# Ordered shipment milestones shown on the delivery / project tracker.
DELIVERY_MILESTONES = (
    "order_placed",
    "ready_at_factory",
    "dispatched_from_factory",
    "received_in_india",
    "received_at_warehouse",
    "dispatched_to_site",
    "reached_site",
    "installed",
)

# Statuses where the PO is live with the distributor and worth chasing.
_LIVE_STATUSES = (
    OrderStatus.SENT.value,
    OrderStatus.APPROVED.value,
    OrderStatus.PARTIALLY_RECEIVED.value,
)

_SOURCE_MODULE = "crm"
_SOURCE_DOC_TYPE = "ovf"

# Template codes (tenant-scoped). Customer overrides append ``__cust_<uuid>``.
KIND_ORDER_ACK = "order_acknowledged"
KIND_ETD_REMINDER = "etd_reminder"
KIND_DELIVERY_UPDATE = "delivery_date_shared"
KIND_PO_SENT_TO_VENDOR = "po_sent_to_vendor"
KIND_ORDER_PROCESSED = "order_processed"
KIND_CUSTOMER_DISPATCH_SHARED = "customer_dispatch_shared"

EVENT_BY_KIND = {
    KIND_ORDER_ACK: "procurement.order_acknowledged",
    KIND_ETD_REMINDER: "procurement.etd_reminder",
    KIND_DELIVERY_UPDATE: "procurement.delivery_date_shared",
    KIND_PO_SENT_TO_VENDOR: "procurement.po_sent_to_vendor",
    KIND_ORDER_PROCESSED: "procurement.order_processed",
    KIND_CUSTOMER_DISPATCH_SHARED: "procurement.customer_dispatch_shared",
}

TEMPLATE_META = {
    KIND_ORDER_ACK: {
        "code": "SCM_ORDER_ACKNOWLEDGED",
        "name": "SCM - Order acknowledgement (customer)",
        "audience": "customer",
        "default_subject": "Your order {{reference}} has been placed",
        "default_body": (
            "<p>Dear {{customer_name}},</p>"
            "<p>Your order against PO <strong>{{reference}}</strong> has been executed and "
            "placed with our supply partner.</p>"
            "<p>The expected delivery date (ETD) is <strong>{{etd}}</strong>.</p>"
            "<p>You will hear from us at least 7 to 10 days before the material "
            "reaches you.</p>"
            "<p>Thank you for your business.</p>"
        ),
    },
    KIND_ETD_REMINDER: {
        "code": "SCM_ETD_REMINDER",
        "name": "SCM - ETD reminder (distributor)",
        "audience": "vendor",
        "default_subject": "Expected delivery date required - PO {{reference}}",
        "default_body": (
            "<p>Dear {{vendor_name}},</p>"
            "<p>We have not yet received an expected delivery date for PO "
            "<strong>{{reference}}</strong> dated {{document_date}}.</p>"
            "<p>Please confirm the ETD at the earliest so we can plan the onward "
            "delivery with our customer.</p>"
        ),
    },
    KIND_DELIVERY_UPDATE: {
        "code": "SCM_DELIVERY_DATE_SHARED",
        "name": "SCM - Delivery date update (customer)",
        "audience": "customer",
        "default_subject": "Expected delivery date for order {{reference}}",
        "default_body": (
            "<p>Dear {{customer_name}},</p>"
            "<p>The material against PO <strong>{{reference}}</strong> is expected with us "
            "by <strong>{{etd}}</strong>.</p>"
            "<p>We will confirm the dispatch plan once the material reaches our warehouse.</p>"
        ),
    },
    KIND_PO_SENT_TO_VENDOR: {
        "code": "SCM_PO_SENT_TO_VENDOR",
        "name": "SCM - Purchase order to vendor",
        "audience": "vendor",
        "default_subject": "Purchase order {{company_po_number}}",
        "default_body": (
            "<p>Dear {{vendor_name}},</p>"
            "<p>Please find attached purchase order "
            "<strong>{{company_po_number}}</strong> dated {{document_date}}.</p>"
            "<p>Kindly confirm acceptance and proceed as per the expected delivery date "
            "on the PO.</p>"
            "<p>Thank you.</p>"
        ),
    },
    KIND_ORDER_PROCESSED: {
        "code": "SCM_ORDER_PROCESSED",
        "name": "SCM - Order processed (customer)",
        "audience": "customer",
        "default_subject": "Your order {{reference}} has been processed",
        "default_body": (
            "<p>Dear {{customer_name}},</p>"
            "<p>Your order against reference <strong>{{reference}}</strong> has been "
            "processed with our supply partner.</p>"
            "<p>The promised delivery date is <strong>{{promised_edd}}</strong>.</p>"
            "<p>We will share dispatch details once material is ready for delivery.</p>"
            "<p>Thank you for your business.</p>"
        ),
    },
    KIND_CUSTOMER_DISPATCH_SHARED: {
        "code": "SCM_CUSTOMER_DISPATCH_SHARED",
        "name": "SCM - Customer dispatch shared",
        "audience": "customer",
        "default_subject": "Dispatch details for order {{reference}}",
        "default_body": (
            "<p>Dear {{customer_name}},</p>"
            "<p>Your material against reference <strong>{{reference}}</strong> has been "
            "dispatched.</p>"
            "<p>Invoice / DC: <strong>{{invoice_or_dc}}</strong><br/>"
            "Transporter LR / AWB: <strong>{{lr_awb}}</strong><br/>"
            "Expected delivery: <strong>{{promised_edd}}</strong></p>"
            "<p>Please confirm receipt when the material arrives.</p>"
        ),
    },
}


def _html(paragraphs: list[str]) -> str:
    body = "".join(f"<p>{line}</p>" for line in paragraphs)
    return f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">{body}</div>'


def _customer_template_code(base_code: str, company_account_id: str | UUID | None) -> str | None:
    if not company_account_id:
        return None
    key = str(company_account_id).replace("-", "")
    return f"{base_code}__cust_{key}"


class ScmDeliveryNotificationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._crm = ProcurementCrmAdapter(db)
        self._master = ProcurementMasterDataAdapter(db)
        self._notifications = NotificationService(db)
        self._ntf_repo = NotificationRepository(db)
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

    # -- templates ---------------------------------------------------------
    def list_templates(
        self, ctx: TenantContext, *, company_account_id: UUID | None = None
    ) -> list[dict[str, Any]]:
        """Default SCM templates plus optional customer-specific overrides."""
        out: list[dict[str, Any]] = []
        for kind, meta in TEMPLATE_META.items():
            base = self._ntf_repo.get_template_by_code(ctx.tenant_id, template_code=meta["code"])
            if base is None:
                self._ntf_repo.create_template(
                    tenant_id=ctx.tenant_id,
                    template_code=meta["code"],
                    template_name=meta["name"],
                    channel="email",
                    subject_template=meta["default_subject"],
                    body_template=meta["default_body"],
                    created_by=ctx.user_id,
                )
                base = self._ntf_repo.get_template_by_code(ctx.tenant_id, template_code=meta["code"])
            elif kind == KIND_ORDER_ACK:
                base = self._upgrade_order_ack_template(ctx, base, meta)
            out.append(self._template_row(kind, base, scope="default", company_account_id=None))
            if company_account_id is not None:
                override_code = _customer_template_code(meta["code"], company_account_id)
                assert override_code is not None
                override = self._ntf_repo.get_template_by_code(
                    ctx.tenant_id, template_code=override_code
                )
                out.append(
                    self._template_row(
                        kind,
                        override,
                        scope="customer",
                        company_account_id=str(company_account_id),
                        fallback=base,
                    )
                )
        return out

    def upsert_template(
        self,
        ctx: TenantContext,
        *,
        kind: str,
        subject_template: str,
        body_template: str,
        company_account_id: UUID | None = None,
    ) -> dict[str, Any]:
        if kind not in TEMPLATE_META:
            raise ValidationException(f"Unknown correspondence kind '{kind}'")
        meta = TEMPLATE_META[kind]
        if company_account_id is not None:
            code = _customer_template_code(meta["code"], company_account_id)
            assert code is not None
            name = f"{meta['name']} (customer override)"
            scope = "customer"
        else:
            code = meta["code"]
            name = meta["name"]
            scope = "default"
        subject = (subject_template or "").strip()
        body = (body_template or "").strip()
        if not subject:
            raise ValidationException("Subject template is required")
        if not body:
            raise ValidationException("Body template is required")
        entity = self._ntf_repo.upsert_template(
            tenant_id=ctx.tenant_id,
            template_code=code,
            template_name=name,
            channel="email",
            subject_template=subject,
            body_template=body,
            updated_by=ctx.user_id,
        )
        return {
            "kind": kind,
            "scope": scope,
            "company_account_id": str(company_account_id) if company_account_id else None,
            "audience": meta["audience"],
            "template_code": entity.template_code,
            "template_name": entity.template_name,
            "subject_template": entity.subject_template,
            "body_template": entity.body_template,
            "is_active": entity.is_active,
            "is_override": scope == "customer",
            "inherits_default": False,
            "placeholders": [
                "customer_name",
                "vendor_name",
                "reference",
                "document_date",
                "etd",
                "promised_edd",
                "company_po_number",
                "invoice_or_dc",
                "lr_awb",
            ],
        }

    def _upgrade_order_ack_template(self, ctx: TenantContext, base, meta: dict[str, str]):
        """Bring shipped defaults forward when the tenant still has the pre-ETD body."""
        body = (getattr(base, "body_template", None) or "").strip()
        if "{{etd}}" in body:
            return base
        legacy_markers = (
            "waiting on the confirmed delivery date",
            "We are waiting on the confirmed delivery date",
        )
        if not any(marker in body for marker in legacy_markers):
            return base
        return self._ntf_repo.upsert_template(
            tenant_id=ctx.tenant_id,
            template_code=meta["code"],
            template_name=meta["name"],
            channel="email",
            subject_template=getattr(base, "subject_template", None) or meta["default_subject"],
            body_template=meta["default_body"],
            updated_by=ctx.user_id,
        )

    def _format_etd(self, order: ProcOrderHeader) -> str:
        etd = order.expected_delivery_date
        if etd is None:
            return "to be confirmed"
        if hasattr(etd, "isoformat"):
            return etd.isoformat()
        return str(etd)

    def _template_row(
        self,
        kind: str,
        row,
        *,
        scope: str,
        company_account_id: str | None,
        fallback=None,
    ) -> dict[str, Any]:
        meta = TEMPLATE_META[kind]
        source = row or fallback
        return {
            "kind": kind,
            "scope": scope,
            "company_account_id": company_account_id,
            "audience": meta["audience"],
            "template_code": (
                row.template_code
                if row is not None
                else _customer_template_code(meta["code"], company_account_id) or meta["code"]
            ),
            "template_name": meta["name"] if scope == "default" else f"{meta['name']} (customer)",
            "subject_template": (
                source.subject_template if source is not None else meta["default_subject"]
            ),
            "body_template": source.body_template if source is not None else meta["default_body"],
            "is_override": scope == "customer" and row is not None,
            "inherits_default": scope == "customer" and row is None,
            "placeholders": [
                "customer_name",
                "vendor_name",
                "reference",
                "document_date",
                "etd",
                "promised_edd",
                "company_po_number",
                "invoice_or_dc",
                "lr_awb",
            ],
        }

    def _resolve_template(
        self,
        ctx: TenantContext,
        *,
        kind: str,
        company_account_id: str | UUID | None,
    ):
        meta = TEMPLATE_META[kind]
        if company_account_id:
            override_code = _customer_template_code(meta["code"], company_account_id)
            if override_code:
                override = self._ntf_repo.get_template_by_code(
                    ctx.tenant_id, template_code=override_code
                )
                if override is not None and override.is_active:
                    return override
        base = self._ntf_repo.get_template_by_code(ctx.tenant_id, template_code=meta["code"])
        if base is None:
            self._ntf_repo.create_template(
                tenant_id=ctx.tenant_id,
                template_code=meta["code"],
                template_name=meta["name"],
                channel="email",
                subject_template=meta["default_subject"],
                body_template=meta["default_body"],
                created_by=ctx.user_id,
            )
            base = self._ntf_repo.get_template_by_code(ctx.tenant_id, template_code=meta["code"])
        return base

    # -- individual messages ----------------------------------------------
    def _send(
        self,
        ctx: TenantContext,
        *,
        to_address: str,
        kind: str,
        order: ProcOrderHeader,
        variables: dict[str, Any],
        company_account_id: str | UUID | None = None,
        require_delivered: bool = False,
        attachments: list[dict[str, Any]] | None = None,
    ) -> None:
        tpl = self._resolve_template(ctx, kind=kind, company_account_id=company_account_id)
        if kind == KIND_ORDER_ACK and tpl is not None:
            meta_for_upgrade = TEMPLATE_META[KIND_ORDER_ACK]
            tpl = self._upgrade_order_ack_template(ctx, tpl, meta_for_upgrade)
        meta = TEMPLATE_META[kind]
        payload = {k: ("" if v is None else str(v)) for k, v in variables.items()}
        if tpl is not None:
            subject = render_template(tpl.subject_template, payload) or meta["default_subject"]
            body_html = render_template(tpl.body_template, payload) or meta["default_body"]
            template_id = tpl.id
        else:
            subject = render_template(meta["default_subject"], payload) or meta["default_subject"]
            body_html = render_template(meta["default_body"], payload) or meta["default_body"]
            template_id = None
        # Wrap plain paragraphs if template forgot outer styling.
        if "<" not in body_html:
            body_html = _html([body_html])
        event_payload: dict[str, Any] = {
            "order_id": str(order.id),
            "company_po_number": order.company_po_number,
            "kind": kind,
            "company_account_id": str(company_account_id) if company_account_id else None,
            **payload,
        }
        if attachments:
            event_payload["_attachments"] = attachments
        event = self._notifications.send_email(
            tenant_id=ctx.tenant_id,
            to_address=to_address,
            subject=subject,
            body_html=body_html,
            event_type=EVENT_BY_KIND[kind],
            template_id=template_id,
            payload_json=event_payload,
            created_by=ctx.user_id,
        )
        if not require_delivered:
            return
        delivery = self._db.scalars(
            select(NtfDelivery)
            .where(
                NtfDelivery.tenant_id == ctx.tenant_id,
                NtfDelivery.event_id == event.id,
            )
            .order_by(NtfDelivery.id.desc())
            .limit(1)
        ).first()
        if delivery is None or (delivery.status or "").lower() != "delivered":
            detail = (
                (delivery.provider_response if delivery is not None else None)
                or (delivery.status if delivery is not None else None)
                or "smtp_send_failed"
            )
            raise ValidationException(f"Failed to send email: {detail}")

    def _order_reference(self, customer: dict[str, Any], order: ProcOrderHeader) -> str:
        return (
            customer.get("po_number")
            or order.company_po_number
            or order.document_number
        )

    def acknowledge_order(
        self,
        ctx: TenantContext,
        order: ProcOrderHeader,
        customer: dict[str, Any],
        *,
        require_delivered: bool = False,
    ) -> bool:
        """Tell the customer their order is placed and share the ETD when known."""
        to_address = customer.get("email")
        if not to_address:
            return False
        reference = self._order_reference(customer, order)
        self._send(
            ctx,
            to_address=to_address,
            kind=KIND_ORDER_ACK,
            order=order,
            company_account_id=customer.get("company_account_id"),
            require_delivered=require_delivered,
            variables={
                "customer_name": customer.get("customer_name")
                or customer.get("account_name")
                or "Customer",
                "vendor_name": "",
                "reference": reference,
                "document_date": order.document_date or "",
                "etd": self._format_etd(order),
                "company_po_number": order.company_po_number or order.document_number,
            },
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
        customer: dict[str, Any] = {}
        if order.source_document_id:
            customer = self._customer_contact(ctx, order.source_document_id)
        self._send(
            ctx,
            to_address=to_address,
            kind=KIND_ETD_REMINDER,
            order=order,
            company_account_id=customer.get("company_account_id"),
            variables={
                "customer_name": customer.get("customer_name") or "",
                "vendor_name": vendor.get("vendor_name") or "Partner",
                "reference": reference,
                "document_date": order.document_date or "",
                "etd": "",
                "company_po_number": order.company_po_number or order.document_number,
            },
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
            kind=KIND_DELIVERY_UPDATE,
            order=order,
            company_account_id=customer.get("company_account_id"),
            variables={
                "customer_name": customer.get("customer_name") or "Customer",
                "vendor_name": "",
                "reference": reference,
                "document_date": order.document_date or "",
                "etd": etd,
                "company_po_number": order.company_po_number or order.document_number,
            },
        )
        order.etd_customer_notified_for = etd
        return True

    def send_po_to_vendor(
        self,
        ctx: TenantContext,
        order: ProcOrderHeader,
        vendor: dict[str, Any],
        *,
        attachments: list[dict[str, Any]] | None = None,
        require_delivered: bool = True,
    ) -> bool:
        """Email the issued PO PDF to the vendor."""
        to_address = (vendor.get("email") or "").strip()
        if not to_address:
            return False
        reference = order.company_po_number or order.document_number
        self._send(
            ctx,
            to_address=to_address,
            kind=KIND_PO_SENT_TO_VENDOR,
            order=order,
            require_delivered=require_delivered,
            attachments=attachments,
            variables={
                "customer_name": "",
                "vendor_name": vendor.get("vendor_name") or "Vendor",
                "reference": reference,
                "document_date": order.document_date or "",
                "etd": self._format_etd(order),
                "company_po_number": reference,
            },
        )
        return True

    def send_customer_order_processed(
        self,
        ctx: TenantContext,
        order: ProcOrderHeader,
        customer: dict[str, Any],
        *,
        require_delivered: bool = True,
    ) -> bool:
        """Tell the customer the order is processed with Customer EDD (vendor EDD + 4)."""
        to_address = (customer.get("email") or "").strip()
        if not to_address:
            return False
        reference = self._order_reference(customer, order)
        promised = order.customer_promised_delivery_date
        promised_label = (
            promised.isoformat()
            if promised is not None and hasattr(promised, "isoformat")
            else (str(promised) if promised else "to be confirmed")
        )
        self._send(
            ctx,
            to_address=to_address,
            kind=KIND_ORDER_PROCESSED,
            order=order,
            company_account_id=customer.get("company_account_id"),
            require_delivered=require_delivered,
            variables={
                "customer_name": customer.get("customer_name")
                or customer.get("account_name")
                or "Customer",
                "vendor_name": "",
                "reference": reference,
                "document_date": order.document_date or "",
                # Customer mail uses the stored Customer EDD exactly. Do not
                # substitute the vendor EDD or shift the date again here.
                "etd": promised_label,
                "promised_edd": promised_label,
                "company_po_number": order.company_po_number or order.document_number,
            },
        )
        return True

    def send_customer_dispatch_shared(
        self,
        ctx: TenantContext,
        order: ProcOrderHeader,
        customer: dict[str, Any],
        *,
        invoice_or_dc: str | None = None,
        lr_awb: str | None = None,
        require_delivered: bool = True,
    ) -> bool:
        """Share customer dispatch / transporter details."""
        to_address = (customer.get("email") or "").strip()
        if not to_address:
            return False
        reference = self._order_reference(customer, order)
        meta = order.customer_delivery_meta if isinstance(order.customer_delivery_meta, dict) else {}
        promised = order.customer_promised_delivery_date or meta.get("customer_edd")
        promised_label = (
            promised.isoformat()
            if promised is not None and hasattr(promised, "isoformat")
            else (str(promised) if promised else "to be confirmed")
        )
        self._send(
            ctx,
            to_address=to_address,
            kind=KIND_CUSTOMER_DISPATCH_SHARED,
            order=order,
            company_account_id=customer.get("company_account_id"),
            require_delivered=require_delivered,
            variables={
                "customer_name": customer.get("customer_name")
                or customer.get("account_name")
                or "Customer",
                "vendor_name": "",
                "reference": reference,
                "document_date": order.document_date or "",
                "etd": self._format_etd(order),
                "promised_edd": promised_label,
                "invoice_or_dc": invoice_or_dc
                or meta.get("invoice_number")
                or meta.get("dc_number")
                or "—",
                "lr_awb": lr_awb or meta.get("lr_awb") or order.awb_number or "—",
                "company_po_number": order.company_po_number or order.document_number,
            },
        )
        return True

    # -- correspondence log ------------------------------------------------
    def _require_order(self, ctx: TenantContext, order_id: UUID) -> ProcOrderHeader:
        order = self._db.get(ProcOrderHeader, order_id)
        if order is None or order.is_deleted or order.tenant_id != ctx.tenant_id:
            raise NotFoundException("Purchase order not found")
        self._scope.validate_company_access(ctx, order.company_id)
        return order

    def company_account_for_order(self, ctx: TenantContext, order_id: UUID) -> UUID | None:
        order = self._require_order(ctx, order_id)
        if not order.source_document_id:
            return None
        contact = self._customer_contact(ctx, order.source_document_id)
        raw = contact.get("company_account_id")
        if not raw:
            return None
        return UUID(str(raw))

    def list_order_correspondence(self, ctx: TenantContext, order_id: UUID) -> list[dict]:
        self._require_order(ctx, order_id)
        return self._ntf_repo.list_deliveries_for_order(ctx.tenant_id, order_id=order_id, limit=100)

    def list_recent_correspondence(self, ctx: TenantContext, *, limit: int = 100) -> list[dict]:
        return self._ntf_repo.list_scm_deliveries(ctx.tenant_id, limit=limit)

    def list_templates_for_order(
        self, ctx: TenantContext, order_id: UUID
    ) -> list[dict[str, Any]]:
        company_account_id = self.company_account_for_order(ctx, order_id)
        return self.list_templates(ctx, company_account_id=company_account_id)

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

    # -- delivery contact / manual acknowledgement send --------------------
    def get_delivery_contact(self, ctx: TenantContext, order_id: UUID) -> dict[str, Any]:
        """CRM customer email for the Delivery Tracking send field."""
        order = self._require_order(ctx, order_id)
        customer: dict[str, Any] = {}
        if order.source_document_id is not None:
            customer = self._customer_contact(ctx, order.source_document_id)
        email = (customer.get("email") or "").strip() or None
        return {
            "order_id": order.id,
            "email": email,
            "crm_email": email,
            "customer_name": customer.get("customer_name")
            or customer.get("account_name"),
            "customer_ack_sent_at": order.customer_ack_sent_at,
        }

    def send_acknowledgement(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        email: str | None = None,
        expected_delivery_date: date | None = None,
    ) -> dict[str, Any]:
        """Send order acknowledgement over SMTP and unlock Record GRN once delivered."""
        order = self._require_order(ctx, order_id)
        if order.status not in _LIVE_STATUSES:
            raise ValidationException(
                "Issue the purchase order before sending delivery acknowledgement"
            )
        if order.customer_ack_sent_at is not None:
            raise ConflictException("Acknowledgement was already sent for this order")
        if not settings.smtp_configured:
            raise ValidationException(
                "SMTP is not configured. Set SMTP_HOST and SMTP_FROM_ADDRESS before sending."
            )

        # One-click Send: persist ETD (if provided) before composing the mail.
        if expected_delivery_date is not None:
            order.expected_delivery_date = expected_delivery_date
            order.etd_confirmed_at = utcnow()
            order.updated_by = ctx.user_id
            self._db.flush()

        customer: dict[str, Any] = {}
        if order.source_document_id is not None:
            customer = self._customer_contact(ctx, order.source_document_id)
        to_address = (email or "").strip() or (customer.get("email") or "").strip()
        if not to_address:
            raise ValidationException(
                "Enter a customer email (none found on the CRM company account)"
            )
        if "@" not in to_address or "." not in to_address.split("@")[-1]:
            raise ValidationException("Enter a valid email address")

        customer_for_send = {
            **customer,
            "email": to_address,
            "customer_name": customer.get("customer_name")
            or customer.get("account_name")
            or "Customer",
        }
        sent = self.acknowledge_order(
            ctx,
            order,
            customer_for_send,
            require_delivered=True,
        )
        if not sent:
            raise ValidationException("Failed to send acknowledgement email")

        order.updated_by = ctx.user_id
        self._db.flush()
        etd_label = self._format_etd(order)
        return {
            "order_id": order.id,
            "email": to_address,
            "customer_ack_sent_at": order.customer_ack_sent_at,
            "dummy": False,
            "etd": None if etd_label == "to be confirmed" else etd_label,
            "message": (
                f"Acknowledgement emailed to {to_address} via SMTP"
                + (
                    f" (ETD {etd_label})."
                    if etd_label != "to be confirmed"
                    else "."
                )
                + " Record GRN is now available."
            ),
        }

    def dummy_send_acknowledgement(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Compatibility alias — now sends real SMTP mail (same as send_acknowledgement)."""
        return self.send_acknowledgement(ctx, order_id, email=email)

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

    def set_delivery_milestone(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        milestone: str,
        awb_number: str | None = None,
        actual_delivery_date: date | None = None,
        note: str | None = None,
    ) -> ProcOrderHeader:
        """Advance shipment tracking: factory → India → warehouse → site, with AWB / docket."""
        if milestone not in DELIVERY_MILESTONES:
            raise ValidationException(f"milestone must be one of {', '.join(DELIVERY_MILESTONES)}")
        order = self._db.get(ProcOrderHeader, order_id)
        if order is None or order.is_deleted or order.tenant_id != ctx.tenant_id:
            raise NotFoundException("Purchase order not found")
        self._scope.validate_company_access(ctx, order.company_id)
        current = order.delivery_milestone
        if current and DELIVERY_MILESTONES.index(milestone) < DELIVERY_MILESTONES.index(current):
            text = (note or "").strip()
            if not text:
                raise ValidationException("Moving a shipment back to an earlier milestone needs a note")
        history = list(order.delivery_milestone_history or [])
        history.append(
            {
                "milestone": milestone,
                "at": utcnow().isoformat(),
                "by": str(ctx.user_id) if ctx.user_id else None,
                "note": (note or "").strip() or None,
                "awb_number": (awb_number or "").strip() or None,
            }
        )
        order.delivery_milestone = milestone
        order.delivery_milestone_history = history
        if awb_number is not None:
            order.awb_number = awb_number.strip() or None
        if actual_delivery_date is not None:
            order.actual_delivery_date = actual_delivery_date
        elif milestone in ("reached_site", "installed") and order.actual_delivery_date is None:
            order.actual_delivery_date = date.today()
        order.updated_by = ctx.user_id
        order.updated_at = utcnow()
        self._db.flush()
        from modules.procurement.service.delivery_project_service import DeliveryProjectService

        DeliveryProjectService(self._db).apply_order_milestone(ctx, order)
        return order
