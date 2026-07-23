"""SCM handoff service — Finance-approved OVF queue → vendor PO → GRN tracking."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter
from modules.procurement.adapters.master_data_adapter import ProcurementMasterDataAdapter
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.domain.exceptions import InvalidDocumentState
from modules.procurement.models.order import ProcOrderHeader, ProcOrderLine
from modules.procurement.repository.order_repository import OrderRepository
from modules.procurement.service.order_service import OrderService
from modules.procurement.service.procurement_scope_validator import ProcurementScopeValidator


def _grn_badge(*, quantity: float, quantity_received: float, line_status: str) -> str:
    if line_status in {"received", "closed"} or (
        quantity > 0 and quantity_received >= quantity
    ):
        return "delivered"
    if quantity_received > 0:
        return "partial"
    return "pending"


def _header_grn_badge(lines: list[ProcOrderLine]) -> str:
    active = [ln for ln in lines if not getattr(ln, "is_deleted", False)]
    if not active:
        return "pending"
    badges = {
        _grn_badge(
            quantity=float(ln.quantity),
            quantity_received=float(ln.quantity_received or 0),
            line_status=ln.status,
        )
        for ln in active
    }
    if badges == {"delivered"}:
        return "closed"
    if "partial" in badges or "delivered" in badges:
        return "partial"
    return "pending"


class ScmHandoffService:
    SOURCE_MODULE = "crm"
    SOURCE_DOC_TYPE = "ovf"

    def __init__(self, db: Session) -> None:
        self._db = db
        self._crm = ProcurementCrmAdapter(db)
        self._master = ProcurementMasterDataAdapter(db)
        self._orders = OrderRepository(db)
        self._order_service = OrderService(db)
        self._scope = ProcurementScopeValidator(db)
        self._audit = AuditService(db)

    def list_scm_queue(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        ovfs = self._crm.list_shared_ovfs(ctx, cid)
        items: list[dict] = []
        for ovf in ovfs:
            existing = self._orders.find_by_source(
                ctx,
                source_module=self.SOURCE_MODULE,
                source_document_type=self.SOURCE_DOC_TYPE,
                source_document_id=ovf.id,
            )
            vendor_total = 0.0
            try:
                handoff = self._crm.get_handoff(ctx, ovf.id)
                vendor_total = sum(float(ln["line_total"]) for ln in handoff["vendor_lines"])
            except ConflictException:
                continue
            items.append(
                {
                    "ovf_id": ovf.id,
                    "ovf_no": ovf.ovf_no,
                    "customer_name": ovf.customer_name,
                    "quote_name": ovf.quote_name,
                    "account_name": ovf.account_name,
                    "po_number": ovf.po_number,
                    "owner_name": ovf.owner_name,
                    "blueprint_state": ovf.blueprint_state,
                    "company_id": ovf.company_id,
                    "branch_id": ovf.branch_id,
                    "vendor_line_count": len(handoff.get("vendor_lines", [])),
                    "vendor_total": vendor_total,
                    "purchase_order_id": existing.id if existing else None,
                    "purchase_order_number": existing.document_number if existing else None,
                    "purchase_order_status": existing.status if existing else None,
                    "can_create_po": existing is None,
                }
            )
        return items

    def get_ovf_preview(self, ctx: TenantContext, ovf_id: UUID) -> dict:
        handoff = self._crm.get_handoff(ctx, ovf_id)
        existing = self._orders.find_by_source(
            ctx,
            source_module=self.SOURCE_MODULE,
            source_document_type=self.SOURCE_DOC_TYPE,
            source_document_id=ovf_id,
        )
        handoff["purchase_order_id"] = existing.id if existing else None
        handoff["purchase_order_number"] = existing.document_number if existing else None
        handoff["can_create_po"] = existing is None
        return handoff

    def create_po_from_ovf(
        self,
        ctx: TenantContext,
        *,
        ovf_id: UUID,
        vendor_id: UUID,
        document_date: date | None = None,
        currency_code: str = "INR",
        payment_terms: str | None = None,
        expected_delivery_date: date | None = None,
        finalize: bool = False,
    ) -> ProcOrderHeader:
        handoff = self._crm.get_handoff(ctx, ovf_id)
        existing = self._orders.find_by_source(
            ctx,
            source_module=self.SOURCE_MODULE,
            source_document_type=self.SOURCE_DOC_TYPE,
            source_document_id=ovf_id,
        )
        if existing is not None:
            raise ConflictException(
                f"Vendor PO already exists for this OVF ({existing.document_number})"
            )

        vendor_lines = handoff.get("vendor_lines") or []
        if not vendor_lines:
            raise ConflictException("OVF has no vendor-side lines to purchase")

        self._master.get_vendor(ctx, vendor_id)
        company_id = handoff["company_id"]
        branch_id = handoff["branch_id"]
        self._scope.validate_company_access(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)

        terms = payment_terms
        if not terms and handoff.get("vendor_payment_days"):
            terms = f"Net {int(handoff['vendor_payment_days'])} days"

        order = self._order_service.create(
            ctx,
            branch_id=branch_id,
            document_date=document_date or date.today(),
            vendor_id=vendor_id,
            currency_code=currency_code,
            company_id=company_id,
            payment_terms=terms,
            expected_delivery_date=expected_delivery_date,
            source_module=self.SOURCE_MODULE,
            source_document_type=self.SOURCE_DOC_TYPE,
            source_document_id=ovf_id,
        )

        uom_id = self._master.resolve_default_uom_id(ctx, company_id)
        for idx, line in enumerate(vendor_lines, start=1):
            product = self._master.resolve_product_for_line(
                ctx,
                company_id=company_id,
                branch_id=branch_id,
                product_name=str(line["product_name"]),
                uom_id=uom_id,
            )
            qty = float(line["qty"])
            unit_cost = float(line["unit_price"])
            if qty <= 0 or unit_cost <= 0:
                raise ConflictException(
                    f"Vendor line '{line['product_name']}' needs qty and unit cost > 0"
                )
            product_id = product.id if hasattr(product, "id") else product
            product_code = getattr(product, "product_code", None)
            self._order_service.add_line(
                ctx,
                order.id,
                line_number=idx,
                product_id=product_id,
                product_code=product_code,
                product_name=str(line["product_name"])[:255],
                quantity=qty,
                uom_id=getattr(product, "uom_id", None) or uom_id,
                unit_cost=unit_cost,
            )

        order = self._order_service.get_order(ctx, order.id)
        if finalize:
            order = self.finalize_scm_po(ctx, order.id)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order.id,
            operation="create_from_ovf",
            performed_by=ctx.user_id,
            new_value={"ovf_id": str(ovf_id), "vendor_id": str(vendor_id)},
        )
        return order

    def finalize_scm_po(self, ctx: TenantContext, order_id: UUID) -> ProcOrderHeader:
        """Issue vendor PO after OVF commercial lock — draft → sent (CRM-sourced only)."""
        order = self._order_service.get_order(ctx, order_id)
        if order.source_module != self.SOURCE_MODULE or order.source_document_type != self.SOURCE_DOC_TYPE:
            raise InvalidDocumentState("Only CRM OVF-sourced POs can use SCM finalize")
        if order.status != OrderStatus.DRAFT.value:
            raise InvalidDocumentState("Only draft SCM POs can be finalized")
        if not order.lines or all(getattr(ln, "is_deleted", False) for ln in order.lines):
            raise InvalidDocumentState("Cannot finalize a PO with no lines")
        updated = self._orders.update_order(ctx, order_id, status=OrderStatus.SENT.value)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order_id,
            operation="scm_finalize",
            performed_by=ctx.user_id,
        )
        return updated or self._order_service.get_order(ctx, order_id)

    def list_vendor_pos(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        orders = self._orders.list_orders_with_lines(ctx, cid)
        result: list[dict] = []
        for order in orders:
            lines = [ln for ln in (order.lines or []) if not getattr(ln, "is_deleted", False)]
            grn = _header_grn_badge(lines)
            result.append(
                {
                    "id": order.id,
                    "document_number": order.document_number,
                    "document_date": order.document_date,
                    "vendor_id": order.vendor_id,
                    "status": order.status,
                    "currency_code": order.currency_code,
                    "total_amount": float(order.total_amount or 0),
                    "source_module": order.source_module,
                    "source_document_type": order.source_document_type,
                    "source_document_id": order.source_document_id,
                    "grn_status": grn,
                    "line_count": len(lines),
                    "lines": [
                        {
                            "id": ln.id,
                            "line_number": ln.line_number,
                            "product_name": ln.product_name,
                            "quantity": float(ln.quantity),
                            "quantity_received": float(ln.quantity_received or 0),
                            "unit_cost": float(ln.unit_cost),
                            "line_total": float(ln.line_total),
                            "status": ln.status,
                            "grn_status": _grn_badge(
                                quantity=float(ln.quantity),
                                quantity_received=float(ln.quantity_received or 0),
                                line_status=ln.status,
                            ),
                        }
                        for ln in lines
                    ],
                }
            )
        return result

    def update_line_receipt(
        self,
        ctx: TenantContext,
        order_id: UUID,
        line_id: UUID,
        *,
        quantity_received: float,
        grn_status: str | None = None,
    ) -> ProcOrderHeader:
        order = self._order_service.get_order(ctx, order_id)
        if order.status in {
            OrderStatus.CANCELLED.value,
            OrderStatus.DRAFT.value,
            OrderStatus.SUBMITTED.value,
        }:
            raise InvalidDocumentState("Receipt can only be recorded on issued purchase orders")

        line = next((ln for ln in order.lines if ln.id == line_id and not ln.is_deleted), None)
        if line is None:
            raise NotFoundException("Order line not found")

        qty = Decimal(str(line.quantity))
        received = Decimal(str(quantity_received))
        if received < 0:
            raise ConflictException("quantity_received cannot be negative")
        if received > qty:
            raise ConflictException("quantity_received cannot exceed ordered quantity")

        status_hint = (grn_status or "").lower().strip()
        if status_hint == "delivered":
            received = qty
            line_status = "received"
        elif status_hint == "pending":
            received = Decimal("0")
            line_status = "open"
        elif status_hint == "partial" or received > 0:
            if received <= 0:
                raise ConflictException("partial receipt requires quantity_received > 0")
            if received >= qty:
                line_status = "received"
            else:
                line_status = "partially_received"
        else:
            line_status = "open" if received == 0 else (
                "received" if received >= qty else "partially_received"
            )

        line.quantity_received = float(received)
        line.status = line_status
        line.updated_by = ctx.user_id

        active = [ln for ln in order.lines if not ln.is_deleted]
        if all(ln.status in {"received", "closed"} for ln in active):
            order.status = OrderStatus.RECEIVED.value
            order.received_amount = float(order.total_amount or 0)
        elif any(float(ln.quantity_received or 0) > 0 for ln in active):
            order.status = OrderStatus.PARTIALLY_RECEIVED.value
            order.received_amount = float(
                sum(
                    Decimal(str(ln.quantity_received or 0)) * Decimal(str(ln.unit_cost))
                    for ln in active
                )
            )
        elif order.status in {
            OrderStatus.PARTIALLY_RECEIVED.value,
            OrderStatus.RECEIVED.value,
        }:
            order.status = OrderStatus.SENT.value
            order.received_amount = 0

        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_line",
            entity_id=line_id,
            operation="grn_update",
            performed_by=ctx.user_id,
            new_value={
                "quantity_received": float(received),
                "status": line_status,
            },
        )
        return self._order_service.get_order(ctx, order_id)
