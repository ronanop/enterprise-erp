"""Post-issue PO fulfillment workflow for CRM and inventory-initiated POs.

Stages: send PO → vendor response → customer order-processed mail → vendor
dispatch → GRN (capped by dispatch) → customer delivery / share / POD.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from core.config import settings
from core.exceptions import ConflictException, NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter
from modules.procurement.adapters.master_data_adapter import ProcurementMasterDataAdapter
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.models.order import ProcOrderHeader, ProcOrderLine
from modules.procurement.models.receipt_batch import (
    ProcOrderReceiptBatch,
    ProcOrderReceiptBatchLine,
)
from modules.procurement.models.vendor_dispatch import ProcVendorDispatch, ProcVendorDispatchLine
from modules.procurement.repository.base import utcnow
from modules.procurement.service.procurement_scope_validator import ProcurementScopeValidator
from modules.procurement.service.scm_delivery_notification_service import (
    ScmDeliveryNotificationService,
)

STAGE_AWAITING_VENDOR_SEND = "awaiting_vendor_send"
STAGE_AWAITING_VENDOR_RESPONSE = "awaiting_vendor_response"
STAGE_VENDOR_REJECTED = "vendor_rejected"
STAGE_VENDOR_ACCEPTED = "vendor_accepted"
STAGE_CUSTOMER_NOTIFIED = "customer_notified"
STAGE_VENDOR_DISPATCH_RECORDED = "vendor_dispatch_recorded"
STAGE_GRN_IN_STOCK = "grn_in_stock"
STAGE_CUSTOMER_DELIVERY_READY = "customer_delivery_ready"
STAGE_CUSTOMER_DISPATCHED = "customer_dispatched"
STAGE_DELIVERED = "delivered"

_LIVE_STATUSES = {
    OrderStatus.SENT.value,
    OrderStatus.APPROVED.value,
    OrderStatus.PARTIALLY_RECEIVED.value,
    OrderStatus.RECEIVED.value,
    OrderStatus.CLOSED.value,
}

# Stages at which GRN is allowed (after customer order-processed + dispatch).
_GRN_UNLOCK_STAGES = {
    STAGE_VENDOR_DISPATCH_RECORDED,
    STAGE_GRN_IN_STOCK,
    STAGE_CUSTOMER_DELIVERY_READY,
    STAGE_CUSTOMER_DISPATCHED,
    STAGE_DELIVERED,
}


class ScmFulfillmentService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = ProcurementScopeValidator(db)
        self._crm = ProcurementCrmAdapter(db)
        self._master = ProcurementMasterDataAdapter(db)
        self._mail = ScmDeliveryNotificationService(db)

    # -- helpers ------------------------------------------------------------
    def _require_order(self, ctx: TenantContext, order_id: UUID) -> ProcOrderHeader:
        order = self._db.get(ProcOrderHeader, order_id)
        if order is None or order.is_deleted or order.tenant_id != ctx.tenant_id:
            raise NotFoundException("Purchase order not found")
        self._scope.validate_company_access(ctx, order.company_id)
        return order

    @staticmethod
    def _fulfillment_eligible(order: ProcOrderHeader) -> bool:
        """CRM OVF/product POs and Create-PO (inventory_initiated) share this chain."""
        module = (order.source_module or "").strip().lower()
        doc_type = (getattr(order, "source_document_type", None) or "").strip().lower()
        if module == "crm":
            return True
        return module == "procurement" and doc_type == "inventory_initiated"

    def _require_fulfillment_live(self, order: ProcOrderHeader) -> None:
        if not self._fulfillment_eligible(order):
            raise ValidationException(
                "Fulfillment workflow applies to CRM and Create-PO purchase orders only"
            )
        if order.status not in _LIVE_STATUSES:
            raise ValidationException("Issue the purchase order before starting fulfillment")

    def _ensure_stage(self, order: ProcOrderHeader) -> str:
        stage = getattr(order, "fulfillment_stage", None)
        if stage:
            return stage
        if order.status in _LIVE_STATUSES and self._fulfillment_eligible(order):
            order.fulfillment_stage = STAGE_AWAITING_VENDOR_SEND
            return STAGE_AWAITING_VENDOR_SEND
        return STAGE_AWAITING_VENDOR_SEND

    def _customer(self, ctx: TenantContext, order: ProcOrderHeader) -> dict[str, Any]:
        fallback_name = (getattr(order, "customer_name", None) or "").strip() or None
        if order.source_document_id is None:
            return {"customer_name": fallback_name} if fallback_name else {}
        try:
            contact = self._crm.get_customer_contact(ctx, order.source_document_id)
            if fallback_name and not (contact.get("customer_name") or contact.get("account_name")):
                contact = {**contact, "customer_name": fallback_name}
            return contact
        except (NotFoundException, ConflictException):
            return {"customer_name": fallback_name} if fallback_name else {}

    def _vendor(self, ctx: TenantContext, order: ProcOrderHeader) -> dict[str, Any]:
        try:
            vendor = self._master.get_vendor(ctx, order.vendor_id)
        except (NotFoundException, ConflictException):
            return {}
        return {
            "email": (getattr(vendor, "email", None) or "").strip() or None,
            "vendor_name": getattr(vendor, "vendor_name", None),
        }

    def _dispatched_qty_by_line(self, order_id: UUID) -> dict[UUID, Decimal]:
        rows = self._db.execute(
            select(
                ProcVendorDispatchLine.order_line_id,
                func.coalesce(func.sum(ProcVendorDispatchLine.dispatch_qty), 0),
            )
            .join(ProcVendorDispatch, ProcVendorDispatch.id == ProcVendorDispatchLine.dispatch_id)
            .where(
                ProcVendorDispatch.order_header_id == order_id,
                ProcVendorDispatch.is_deleted.is_(False),
                ProcVendorDispatch.status != "cancelled",
                ProcVendorDispatchLine.is_deleted.is_(False),
            )
            .group_by(ProcVendorDispatchLine.order_line_id)
        ).all()
        return {row[0]: Decimal(str(row[1] or 0)) for row in rows}

    def _grn_qty_by_line_for_dispatch(self, dispatch_id: UUID) -> dict[UUID, Decimal]:
        rows = self._db.execute(
            select(
                ProcOrderReceiptBatchLine.order_line_id,
                func.coalesce(func.sum(ProcOrderReceiptBatchLine.quantity), 0),
            )
            .join(
                ProcOrderReceiptBatch,
                ProcOrderReceiptBatch.id == ProcOrderReceiptBatchLine.receipt_batch_id,
            )
            .where(
                ProcOrderReceiptBatch.vendor_dispatch_id == dispatch_id,
                ProcOrderReceiptBatch.is_deleted.is_(False),
                ProcOrderReceiptBatch.reversal_status != "reversed",
                ProcOrderReceiptBatchLine.is_deleted.is_(False),
            )
            .group_by(ProcOrderReceiptBatchLine.order_line_id)
        ).all()
        return {row[0]: Decimal(str(row[1] or 0)) for row in rows}

    def _grn_numbers_for_dispatch(self, dispatch_id: UUID) -> list[str]:
        rows = self._db.scalars(
            select(ProcOrderReceiptBatch.grn_number)
            .where(
                ProcOrderReceiptBatch.vendor_dispatch_id == dispatch_id,
                ProcOrderReceiptBatch.is_deleted.is_(False),
                ProcOrderReceiptBatch.reversal_status != "reversed",
            )
            .order_by(ProcOrderReceiptBatch.sequence.asc())
        ).all()
        out: list[str] = []
        for num in rows:
            label = (num or "").strip()
            if label and label not in out:
                out.append(label)
        return out

    def wave_remaining_for_line(
        self, dispatch_id: UUID, order_line_id: UUID
    ) -> Decimal:
        dispatch = self._db.get(ProcVendorDispatch, dispatch_id)
        if dispatch is None or getattr(dispatch, "is_deleted", False):
            return Decimal("0")
        wave_qty = Decimal("0")
        for ln in dispatch.lines or []:
            if getattr(ln, "is_deleted", False):
                continue
            if ln.order_line_id == order_line_id:
                wave_qty += Decimal(str(ln.dispatch_qty or 0))
        already = self._grn_qty_by_line_for_dispatch(dispatch_id).get(
            order_line_id, Decimal("0")
        )
        return max(wave_qty - already, Decimal("0"))

    def _list_dispatches(self, order_id: UUID) -> list[ProcVendorDispatch]:
        return list(
            self._db.scalars(
                select(ProcVendorDispatch)
                .options(selectinload(ProcVendorDispatch.lines))
                .where(
                    ProcVendorDispatch.order_header_id == order_id,
                    ProcVendorDispatch.is_deleted.is_(False),
                )
                .order_by(ProcVendorDispatch.sequence.asc())
            ).all()
        )

    def _serialize_dispatch(self, row: ProcVendorDispatch) -> dict[str, Any]:
        grn_by_line = self._grn_qty_by_line_for_dispatch(row.id)
        lines_out: list[dict[str, Any]] = []
        dispatch_total = Decimal("0")
        grn_total = Decimal("0")
        for ln in row.lines or []:
            if getattr(ln, "is_deleted", False):
                continue
            disp = Decimal(str(ln.dispatch_qty or 0))
            received = grn_by_line.get(ln.order_line_id, Decimal("0"))
            dispatch_total += disp
            grn_total += received
            lines_out.append(
                {
                    "id": ln.id,
                    "order_line_id": ln.order_line_id,
                    "dispatch_qty": float(disp),
                    "grn_received_qty": float(received),
                    "grn_remaining_qty": float(max(disp - received, Decimal("0"))),
                }
            )
        if grn_total <= 0:
            grn_status = "pending"
        elif grn_total + Decimal("0.0001") >= dispatch_total:
            grn_status = "done"
        else:
            grn_status = "partial"
        # Keep stored status in sync when fully GRN'd.
        if grn_status == "done" and row.status != "grn_done":
            row.status = "grn_done"
        elif grn_status != "done" and row.status == "grn_done":
            row.status = "recorded"
        return {
            "id": row.id,
            "order_header_id": row.order_header_id,
            "sequence": row.sequence,
            "dc_number": row.dc_number,
            "invoice_number": row.invoice_number,
            "lr_awb_number": row.lr_awb_number,
            "dispatch_date": row.dispatch_date,
            "eway_notes": row.eway_notes,
            "transport_notes": row.transport_notes,
            "attachment_refs": row.attachment_refs,
            "status": row.status,
            "grn_status": grn_status,
            "grn_received_qty": float(grn_total),
            "grn_dispatch_qty": float(dispatch_total),
            "grn_numbers": self._grn_numbers_for_dispatch(row.id),
            "created_at": row.created_at,
            "lines": lines_out,
        }

    def get_fulfillment(self, ctx: TenantContext, order_id: UUID) -> dict[str, Any]:
        order = self._require_order(ctx, order_id)
        stage = (
            self._ensure_stage(order) if self._fulfillment_eligible(order) else None
        )
        if stage and not getattr(order, "fulfillment_stage", None):
            self._db.flush()
        dispatched = self._dispatched_qty_by_line(order.id)
        lines = []
        for ln in order.lines or []:
            if getattr(ln, "is_deleted", False):
                continue
            ordered = Decimal(str(ln.quantity or 0))
            disp = dispatched.get(ln.id, Decimal("0"))
            received = Decimal(str(ln.quantity_received or 0))
            lines.append(
                {
                    "order_line_id": ln.id,
                    "line_number": ln.line_number,
                    "product_name": ln.product_name,
                    "product_code": ln.product_code,
                    "ordered_qty": float(ordered),
                    "dispatched_qty": float(disp),
                    "remaining_to_dispatch": float(max(ordered - disp, Decimal("0"))),
                    "received_qty": float(received),
                    "grn_cap_qty": float(disp),
                }
            )
        customer = self._customer(ctx, order)
        vendor = self._vendor(ctx, order)
        return {
            "order_id": order.id,
            "fulfillment_stage": getattr(order, "fulfillment_stage", None),
            "vendor_response_status": getattr(order, "vendor_response_status", None) or "pending",
            "vendor_response_remark": getattr(order, "vendor_response_remark", None),
            "vendor_responded_at": getattr(order, "vendor_responded_at", None),
            "expected_delivery_date": order.expected_delivery_date,
            "customer_promised_delivery_date": getattr(
                order, "customer_promised_delivery_date", None
            ),
            "po_sent_to_vendor_at": getattr(order, "po_sent_to_vendor_at", None),
            "customer_order_processed_sent_at": getattr(
                order, "customer_order_processed_sent_at", None
            ),
            "customer_dispatch_shared_at": getattr(order, "customer_dispatch_shared_at", None),
            "customer_pod_uploaded_at": getattr(order, "customer_pod_uploaded_at", None),
            "customer_delivery_meta": getattr(order, "customer_delivery_meta", None) or {},
            "grn_unlocked": (getattr(order, "fulfillment_stage", None) or "") in _GRN_UNLOCK_STAGES,
            "vendor_email": vendor.get("email"),
            "vendor_name": vendor.get("vendor_name"),
            "customer_email": customer.get("email"),
            "customer_name": customer.get("customer_name") or customer.get("account_name"),
            "lines": lines,
            "dispatches": [self._serialize_dispatch(d) for d in self._list_dispatches(order.id)],
        }

    # -- stage actions ------------------------------------------------------
    def send_to_vendor(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        email: str | None = None,
        po_pdf_base64: str | None = None,
        po_pdf_filename: str | None = None,
    ) -> dict[str, Any]:
        order = self._require_order(ctx, order_id)
        self._require_fulfillment_live(order)
        stage = self._ensure_stage(order)
        if stage not in {STAGE_AWAITING_VENDOR_SEND}:
            if getattr(order, "po_sent_to_vendor_at", None) is not None:
                raise ConflictException("PO was already sent to the vendor")
            raise ValidationException(f"Cannot send PO to vendor from stage '{stage}'")
        if not settings.smtp_configured:
            raise ValidationException(
                "SMTP is not configured. Set SMTP_HOST and SMTP_FROM_ADDRESS before sending."
            )

        vendor = self._vendor(ctx, order)
        to_address = (email or "").strip() or (vendor.get("email") or "").strip()
        if not to_address:
            raise ValidationException("Vendor email is required to send the purchase order")
        vendor_for_send = {**vendor, "email": to_address}

        attachments: list[dict[str, Any]] = []
        try:
            from modules.procurement.service.scm_handoff_service import ScmHandoffService

            attachments = ScmHandoffService(self._db)._po_print_email_attachments(
                ctx,
                order.id,
                po_pdf_base64=po_pdf_base64,
                po_pdf_filename=po_pdf_filename,
                exclude_draft=True,
            )
        except Exception:  # noqa: BLE001
            attachments = []

        sent = self._mail.send_po_to_vendor(
            ctx,
            order,
            vendor_for_send,
            attachments=attachments or None,
            require_delivered=True,
        )
        if not sent:
            raise ValidationException("Failed to send purchase order email to vendor")

        order.po_sent_to_vendor_at = utcnow()
        order.fulfillment_stage = STAGE_AWAITING_VENDOR_RESPONSE
        order.vendor_response_status = "pending"
        order.updated_by = ctx.user_id
        order.updated_at = utcnow()
        self._db.flush()
        return self.get_fulfillment(ctx, order_id)

    def record_vendor_response(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        status: str,
        remark: str | None = None,
        expected_delivery_date: date | None = None,
    ) -> dict[str, Any]:
        order = self._require_order(ctx, order_id)
        self._require_fulfillment_live(order)
        stage = self._ensure_stage(order)
        if stage != STAGE_AWAITING_VENDOR_RESPONSE:
            raise ValidationException(
                f"Vendor response is only allowed while awaiting vendor response (current: {stage})"
            )
        decision = (status or "").strip().lower()
        if decision not in {"accepted", "rejected"}:
            raise ValidationException("status must be accepted or rejected")
        remark_clean = (remark or "").strip() or None
        if decision == "rejected" and not remark_clean:
            raise ValidationException("Remarks are required when the vendor rejects the PO")
        if decision == "accepted":
            edd = expected_delivery_date or order.expected_delivery_date
            if edd is None:
                raise ValidationException(
                    "Enter the vendor expected delivery date (EDD) before accepting"
                )
            order.expected_delivery_date = edd
            order.etd_confirmed_at = utcnow()
            order.customer_promised_delivery_date = edd + timedelta(days=4)
            order.fulfillment_stage = STAGE_VENDOR_ACCEPTED
            order.vendor_response_status = "accepted"
        else:
            order.fulfillment_stage = STAGE_VENDOR_REJECTED
            order.vendor_response_status = "rejected"
            order.customer_promised_delivery_date = None

        order.vendor_response_remark = remark_clean
        order.vendor_responded_at = utcnow()
        order.updated_by = ctx.user_id
        order.updated_at = utcnow()
        self._db.flush()
        return self.get_fulfillment(ctx, order_id)

    def send_customer_order_processed(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        email: str | None = None,
    ) -> dict[str, Any]:
        order = self._require_order(ctx, order_id)
        self._require_fulfillment_live(order)
        stage = self._ensure_stage(order)
        if stage != STAGE_VENDOR_ACCEPTED:
            raise ValidationException(
                "Send customer order-processed mail only after the vendor accepts"
            )
        if getattr(order, "customer_promised_delivery_date", None) is None:
            raise ValidationException(
                "Customer EDD is missing. Accept the vendor response with a vendor EDD first."
            )
        if not settings.smtp_configured:
            raise ValidationException(
                "SMTP is not configured. Set SMTP_HOST and SMTP_FROM_ADDRESS before sending."
            )

        customer = self._customer(ctx, order)
        to_address = (email or "").strip() or (customer.get("email") or "").strip()
        if not to_address:
            raise ValidationException("Customer email is required")
        customer_for_send = {**customer, "email": to_address}
        sent = self._mail.send_customer_order_processed(
            ctx, order, customer_for_send, require_delivered=True
        )
        if not sent:
            raise ValidationException("Failed to send order-processed email to customer")

        order.customer_order_processed_sent_at = utcnow()
        order.fulfillment_stage = STAGE_CUSTOMER_NOTIFIED
        order.updated_by = ctx.user_id
        order.updated_at = utcnow()
        self._db.flush()
        return self.get_fulfillment(ctx, order_id)

    def create_vendor_dispatch(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        dc_number: str | None = None,
        invoice_number: str | None = None,
        lr_awb_number: str | None = None,
        dispatch_date: date | None = None,
        eway_notes: str | None = None,
        transport_notes: str | None = None,
        attachment_refs: dict | list | None = None,
        lines: list[dict[str, Any]],
    ) -> dict[str, Any]:
        order = self._require_order(ctx, order_id)
        self._require_fulfillment_live(order)
        stage = self._ensure_stage(order)
        if stage not in {
            STAGE_CUSTOMER_NOTIFIED,
            STAGE_VENDOR_DISPATCH_RECORDED,
            STAGE_GRN_IN_STOCK,
            STAGE_CUSTOMER_DELIVERY_READY,
        }:
            raise ValidationException(
                "Record vendor dispatch after the customer has been notified of order processing"
            )
        if not lines:
            raise ValidationException("At least one dispatch line is required")

        dc_clean = (dc_number or "").strip()
        inv_clean = (invoice_number or "").strip()
        lr_clean = (lr_awb_number or "").strip()
        if not dc_clean:
            raise ValidationException("DC number is required")
        if not inv_clean:
            raise ValidationException("Invoice number is required")
        if not lr_clean:
            raise ValidationException("LR / AWB number is required")

        refs = attachment_refs if isinstance(attachment_refs, dict) else {}
        for key, label in (
            ("dc", "DC document"),
            ("invoice", "Invoice document"),
            ("lr_awb", "LR / AWB document"),
        ):
            doc = refs.get(key)
            if not isinstance(doc, dict) or not (
                (doc.get("content_base64") or "").strip()
                or (doc.get("file_name") or "").strip()
            ):
                raise ValidationException(f"{label} is required")

        active_lines = {
            ln.id: ln
            for ln in (order.lines or [])
            if not getattr(ln, "is_deleted", False)
        }
        already = self._dispatched_qty_by_line(order.id)
        parsed: list[tuple[ProcOrderLine, Decimal]] = []
        for raw in lines:
            line_id = raw.get("order_line_id")
            if isinstance(line_id, str):
                line_id = UUID(line_id)
            qty = Decimal(str(raw.get("dispatch_qty") or 0))
            if qty <= 0:
                raise ValidationException("Received qty must be greater than zero")
            line = active_lines.get(line_id)
            if line is None:
                raise NotFoundException(f"Order line {line_id} not found")
            ordered = Decimal(str(line.quantity or 0))
            prior = already.get(line.id, Decimal("0"))
            remaining = ordered - prior
            if qty > remaining + Decimal("0.0001"):
                raise ValidationException(
                    f"Received qty for line {line.line_number} cannot exceed "
                    f"ordered qty remaining ({float(remaining)})"
                )
            parsed.append((line, qty))

        next_seq = (
            self._db.scalar(
                select(func.coalesce(func.max(ProcVendorDispatch.sequence), 0)).where(
                    ProcVendorDispatch.order_header_id == order.id,
                    ProcVendorDispatch.is_deleted.is_(False),
                )
            )
            or 0
        ) + 1

        header = ProcVendorDispatch(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=order.company_id,
            branch_id=order.branch_id,
            order_header_id=order.id,
            sequence=int(next_seq),
            dc_number=dc_clean,
            invoice_number=inv_clean,
            lr_awb_number=lr_clean,
            dispatch_date=dispatch_date,
            eway_notes=(eway_notes or "").strip() or None,
            transport_notes=(transport_notes or "").strip() or None,
            attachment_refs=attachment_refs,
            status="recorded",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(header)
        self._db.flush()
        for line, qty in parsed:
            self._db.add(
                ProcVendorDispatchLine(
                    id=uuid4(),
                    tenant_id=ctx.tenant_id,
                    company_id=order.company_id,
                    branch_id=order.branch_id,
                    dispatch_id=header.id,
                    order_line_id=line.id,
                    dispatch_qty=float(qty),
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
            )

        order.fulfillment_stage = STAGE_VENDOR_DISPATCH_RECORDED
        order.updated_by = ctx.user_id
        order.updated_at = utcnow()
        self._db.flush()
        return self.get_fulfillment(ctx, order_id)

    def assert_grn_allowed(
        self,
        ctx: TenantContext,
        order: ProcOrderHeader,
        *,
        line_id: UUID,
        target_received_qty: Decimal,
        previous_received_qty: Decimal | None = None,
        vendor_dispatch_id: UUID | None = None,
    ) -> None:
        """Gate GRN: fulfillment must be past customer notify + dispatch; cap by dispatched."""
        if not self._fulfillment_eligible(order):
            return
        stage = self._ensure_stage(order)
        if stage not in _GRN_UNLOCK_STAGES:
            raise ConflictException(
                "Record vendor dispatch (after customer order-processed mail) before GRN"
            )
        caps = self._dispatched_qty_by_line(order.id)
        cap = caps.get(line_id, Decimal("0"))
        if target_received_qty > cap + Decimal("0.0001"):
            raise ConflictException(
                f"Received qty cannot exceed vendor-dispatched qty ({float(cap)}) for this line"
            )
        if vendor_dispatch_id is None:
            return
        dispatch = self._db.get(ProcVendorDispatch, vendor_dispatch_id)
        if (
            dispatch is None
            or getattr(dispatch, "is_deleted", False)
            or dispatch.order_header_id != order.id
        ):
            raise ValidationException("Vendor dispatch wave not found for this PO")
        previous = (
            previous_received_qty
            if previous_received_qty is not None
            else Decimal("0")
        )
        delta = target_received_qty - previous
        if delta <= 0:
            return
        remaining = self.wave_remaining_for_line(vendor_dispatch_id, line_id)
        if delta > remaining + Decimal("0.0001"):
            raise ConflictException(
                f"GRN qty for this wave cannot exceed remaining wave qty ({float(remaining)})"
            )

    def mark_grn_progress(self, ctx: TenantContext, order: ProcOrderHeader) -> None:
        """Advance stage after GRN when all dispatched qty is received."""
        if not self._fulfillment_eligible(order):
            return
        stage = getattr(order, "fulfillment_stage", None)
        if stage not in {STAGE_VENDOR_DISPATCH_RECORDED, STAGE_GRN_IN_STOCK}:
            return
        caps = self._dispatched_qty_by_line(order.id)
        if not caps:
            return
        all_in = True
        for ln in order.lines or []:
            if getattr(ln, "is_deleted", False):
                continue
            cap = caps.get(ln.id, Decimal("0"))
            if cap <= 0:
                continue
            received = Decimal(str(ln.quantity_received or 0))
            if received + Decimal("0.0001") < cap:
                all_in = False
                break
        if all_in:
            order.fulfillment_stage = STAGE_GRN_IN_STOCK
            # Unlock customer delivery once current dispatch wave is in stock.
            order.fulfillment_stage = STAGE_CUSTOMER_DELIVERY_READY
            order.updated_by = ctx.user_id
            order.updated_at = utcnow()

    def upsert_customer_delivery(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        meta: dict[str, Any],
        mark_ready: bool = False,
    ) -> dict[str, Any]:
        order = self._require_order(ctx, order_id)
        self._require_fulfillment_live(order)
        stage = self._ensure_stage(order)
        if stage not in {
            STAGE_GRN_IN_STOCK,
            STAGE_CUSTOMER_DELIVERY_READY,
            STAGE_CUSTOMER_DISPATCHED,
            STAGE_DELIVERED,
            STAGE_VENDOR_DISPATCH_RECORDED,
        }:
            # Allow prep once GRN has started (partial) from dispatch-recorded.
            if stage != STAGE_VENDOR_DISPATCH_RECORDED:
                raise ValidationException(
                    "Customer delivery is available after GRN of dispatched quantity"
                )
        existing = (
            dict(order.customer_delivery_meta)
            if isinstance(order.customer_delivery_meta, dict)
            else {}
        )
        existing.update({k: v for k, v in (meta or {}).items() if v is not None})
        order.customer_delivery_meta = existing
        if mark_ready or stage in {STAGE_GRN_IN_STOCK, STAGE_VENDOR_DISPATCH_RECORDED}:
            # Only bump to ready if some receipt exists for dispatched qty.
            caps = self._dispatched_qty_by_line(order.id)
            any_received = any(
                Decimal(str(ln.quantity_received or 0)) > 0
                for ln in (order.lines or [])
                if not getattr(ln, "is_deleted", False) and caps.get(ln.id, Decimal("0")) > 0
            )
            if any_received and stage in {
                STAGE_GRN_IN_STOCK,
                STAGE_VENDOR_DISPATCH_RECORDED,
                STAGE_CUSTOMER_DELIVERY_READY,
            }:
                order.fulfillment_stage = STAGE_CUSTOMER_DELIVERY_READY
        order.updated_by = ctx.user_id
        order.updated_at = utcnow()
        self._db.flush()
        return self.get_fulfillment(ctx, order_id)

    def share_customer_dispatch(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        email: str | None = None,
    ) -> dict[str, Any]:
        order = self._require_order(ctx, order_id)
        self._require_fulfillment_live(order)
        stage = self._ensure_stage(order)
        if stage not in {STAGE_CUSTOMER_DELIVERY_READY, STAGE_CUSTOMER_DISPATCHED}:
            raise ValidationException(
                "Confirm customer delivery details before sharing dispatch"
            )
        if not settings.smtp_configured:
            raise ValidationException(
                "SMTP is not configured. Set SMTP_HOST and SMTP_FROM_ADDRESS before sending."
            )
        customer = self._customer(ctx, order)
        to_address = (email or "").strip() or (customer.get("email") or "").strip()
        if not to_address:
            raise ValidationException("Customer email is required")
        meta = order.customer_delivery_meta if isinstance(order.customer_delivery_meta, dict) else {}
        invoice_or_dc = meta.get("invoice_number") or meta.get("dc_number")
        lr_awb = meta.get("lr_awb") or order.awb_number
        sent = self._mail.send_customer_dispatch_shared(
            ctx,
            order,
            {**customer, "email": to_address},
            invoice_or_dc=invoice_or_dc,
            lr_awb=lr_awb,
            require_delivered=True,
        )
        if not sent:
            raise ValidationException("Failed to share dispatch details with customer")
        order.customer_dispatch_shared_at = utcnow()
        order.fulfillment_stage = STAGE_CUSTOMER_DISPATCHED
        if meta.get("lr_awb"):
            order.awb_number = str(meta["lr_awb"])[:100]
        order.updated_by = ctx.user_id
        order.updated_at = utcnow()
        self._db.flush()
        return self.get_fulfillment(ctx, order_id)

    def upload_customer_pod(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        pod_ref: dict[str, Any] | None = None,
        note: str | None = None,
    ) -> dict[str, Any]:
        order = self._require_order(ctx, order_id)
        self._require_fulfillment_live(order)
        stage = self._ensure_stage(order)
        if stage not in {STAGE_CUSTOMER_DISPATCHED, STAGE_DELIVERED}:
            raise ValidationException("Upload POD after customer dispatch has been shared")
        meta = (
            dict(order.customer_delivery_meta)
            if isinstance(order.customer_delivery_meta, dict)
            else {}
        )
        if pod_ref:
            meta["pod"] = pod_ref
        if note:
            meta["pod_note"] = note
        order.customer_delivery_meta = meta
        order.customer_pod_uploaded_at = utcnow()
        order.fulfillment_stage = STAGE_DELIVERED
        order.actual_delivery_date = order.actual_delivery_date or date.today()
        order.updated_by = ctx.user_id
        order.updated_at = utcnow()
        self._db.flush()
        return self.get_fulfillment(ctx, order_id)

    def initialize_on_issue(self, order: ProcOrderHeader) -> None:
        """Called when an eligible PO is issued (status → sent)."""
        if not self._fulfillment_eligible(order):
            return
        if not getattr(order, "fulfillment_stage", None):
            order.fulfillment_stage = STAGE_AWAITING_VENDOR_SEND
        if not getattr(order, "vendor_response_status", None):
            order.vendor_response_status = "pending"
