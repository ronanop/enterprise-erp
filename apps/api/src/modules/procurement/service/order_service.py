"""Purchase order service."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter
from modules.procurement.domain.enums import OrderStatus, ProcEntityType
from modules.procurement.domain.exceptions import InvalidDocumentState, SegregationOfDutiesError
from modules.procurement.domain.value_objects import LineTotals
from modules.procurement.models.order import ProcOrderHeader
from modules.procurement.repository.base import utcnow
from modules.procurement.repository.order_repository import OrderRepository
from modules.procurement.schemas import OrderResponse
from modules.procurement.service.document_number_service import DocumentNumberService
from modules.procurement.service.engines.order_engine import OrderEngine
from modules.procurement.service.governance_service import ProcurementGovernanceService
from modules.procurement.service.procurement_scope_validator import ProcurementScopeValidator
from modules.procurement.service.scm_commercial import scm_total_margin_amount

_OVF_SOURCE_MODULE = "crm"
_OVF_SOURCE_DOC = "ovf"


def _commercial_totals_for_order(
    row: ProcOrderHeader,
    summary: dict | None,
) -> tuple[float, float, float]:
    vendor_total = float(row.total_amount or 0)
    customer_total = 0.0
    margin_amount = 0.0
    if not summary:
        return vendor_total, customer_total, margin_amount
    if summary.get("vendor_total") is not None:
        vendor_total = float(summary["vendor_total"])
    elif summary.get("vendor_lines"):
        vendor_total = sum(float(ln["line_total"]) for ln in summary["vendor_lines"])
    if summary.get("customer_total") is not None:
        customer_total = float(summary["customer_total"])
    elif summary.get("customer_lines"):
        customer_total = sum(float(ln["line_total"]) for ln in summary["customer_lines"])
    if summary.get("total_margin_amount") is not None:
        margin_amount = float(summary["total_margin_amount"])
    else:
        margin_amount = scm_total_margin_amount(
            summary,
            customer_total=customer_total,
            vendor_total=vendor_total,
        )
    return vendor_total, customer_total, margin_amount


class OrderService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = OrderRepository(db)
        self._scope = ProcurementScopeValidator(db)
        self._engine = OrderEngine()
        self._numbers = DocumentNumberService(db)
        self._governance = ProcurementGovernanceService(db)
        self._audit = AuditService(db)
        self._crm = ProcurementCrmAdapter(db)

    def list_orders(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_orders(ctx, cid)

    def list_order_responses(
        self, ctx: TenantContext, company_id: UUID | None = None, *, enrich_commercial: bool = False
    ) -> list[OrderResponse]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_orders_with_lines(ctx, cid)
        return self._to_order_responses(ctx, rows, enrich_commercial=enrich_commercial)

    def get_order(self, ctx: TenantContext, order_id: UUID) -> ProcOrderHeader:
        row = self._repo.get_order(ctx, order_id)
        if row is None:
            raise NotFoundException("Purchase order not found")
        self._scope.validate_company_access(ctx, row.company_id)
        self._scope.validate_branch_access(ctx, row.branch_id)
        return row

    def get_order_response(
        self, ctx: TenantContext, order_id: UUID, *, enrich_commercial: bool = False
    ) -> OrderResponse:
        return self._to_order_responses(
            ctx, [self.get_order(ctx, order_id)], enrich_commercial=enrich_commercial
        )[0]

    def _to_order_responses(
        self,
        ctx: TenantContext,
        rows: list[ProcOrderHeader],
        *,
        enrich_commercial: bool = False,
    ) -> list[OrderResponse]:
        ovf_ids = [
            row.source_document_id
            for row in rows
            if row.source_module == "crm"
            and row.source_document_type == "ovf"
            and row.source_document_id is not None
        ]
        meta = self._crm.get_ovf_display_meta(ctx, ovf_ids) if ovf_ids else {}
        commercial_cache: dict[UUID, dict] = {}
        out: list[OrderResponse] = []
        for row in rows:
            payload = OrderResponse.model_validate(row)
            if (
                row.source_module == _OVF_SOURCE_MODULE
                and row.source_document_type == _OVF_SOURCE_DOC
                and row.source_document_id is not None
            ):
                ovf_id = row.source_document_id
                ovf = meta.get(ovf_id) or {}
                updates: dict[str, object] = {
                    "customer_name": ovf.get("customer_name"),
                    "customer_po_number": ovf.get("po_number"),
                    "customer_payment_days": int(ovf.get("customer_payment_days") or 0),
                }
                po_date = ovf.get("po_date")
                if po_date is not None:
                    updates["ovf_date"] = po_date
                if enrich_commercial:
                    if ovf_id not in commercial_cache:
                        try:
                            commercial_cache[ovf_id] = self._crm.get_commercial_export(
                                ctx, ovf_id
                            )
                        except Exception:
                            commercial_cache[ovf_id] = {}
                    summary = commercial_cache[ovf_id]
                    vendor_total = float(summary.get("vendor_total") or row.total_amount or 0)
                    customer_total = float(summary.get("customer_total") or 0)
                    margin_amount = float(summary.get("total_margin_amount") or 0)
                    updates.update(
                        {
                            "vendor_total": vendor_total,
                            "customer_total": customer_total,
                            "margin_amount": margin_amount,
                            "customer_tax_amount": float(summary.get("customer_tax_amount") or 0),
                            "customer_total_with_tax": float(
                                summary.get("customer_total_with_tax") or 0
                            ),
                            "vendor_tax_amount": float(summary.get("vendor_tax_amount") or 0),
                            "vendor_total_with_tax": float(
                                summary.get("vendor_total_with_tax") or 0
                            ),
                            "margin_pct": float(summary.get("margin_pct") or 0),
                            "description": summary.get("description"),
                            "customer_po_number": summary.get("customer_po_number")
                            or ovf.get("po_number"),
                            "customer_payment_days": int(
                                summary.get("customer_payment_days")
                                or ovf.get("customer_payment_days")
                                or 0
                            ),
                        }
                    )
                    if summary.get("customer_po_date") is not None:
                        updates["ovf_date"] = summary.get("customer_po_date")
                else:
                    updates["vendor_total"] = float(row.total_amount or 0)
                payload = payload.model_copy(update=updates)
            else:
                vendor_total, _, _ = _commercial_totals_for_order(row, None)
                payload = payload.model_copy(update={"vendor_total": vendor_total})
            out.append(payload)
        return out

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        document_date,
        vendor_id: UUID,
        currency_code: str,
        company_id: UUID | None = None,
        exchange_rate: float = 1.0,
        requisition_header_id: UUID | None = None,
        rfq_header_id: UUID | None = None,
        vendor_quotation_header_id: UUID | None = None,
        contract_id: UUID | None = None,
        payment_terms: str | None = None,
        expected_delivery_date=None,
        source_module: str | None = None,
        source_document_type: str | None = None,
        source_document_id: UUID | None = None,
        entity_code: str | None = None,
        company_po_number: str | None = None,
        approved_by_name: str | None = None,
        order_ref_cache: str | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc_number = self._numbers.generate(
            ProcEntityType.ORDER,
            cid,
            model=ProcOrderHeader,
            code_column="document_number",
        )
        row = self._repo.create_order(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc_number,
            document_date=document_date,
            vendor_id=vendor_id,
            requisition_header_id=requisition_header_id,
            rfq_header_id=rfq_header_id,
            vendor_quotation_header_id=vendor_quotation_header_id,
            contract_id=contract_id,
            payment_terms=payment_terms,
            expected_delivery_date=expected_delivery_date,
            currency_code=currency_code,
            exchange_rate=exchange_rate,
            status=OrderStatus.DRAFT.value,
            workflow_status=WorkflowStatus.PENDING.value,
            source_module=source_module,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            entity_code=entity_code,
            company_po_number=company_po_number,
            approved_by_name=(approved_by_name or "").strip() or None,
            order_ref_cache=(order_ref_cache or "").strip() or None,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def add_line(self, ctx: TenantContext, order_id: UUID, **fields):
        order = self.get_order(ctx, order_id)
        if order.status != OrderStatus.DRAFT.value:
            raise InvalidDocumentState("Lines can only be added to draft orders")
        line = self._repo.add_line(ctx, order, **fields)
        totals = LineTotals.compute(
            quantity=Decimal(str(line.quantity)),
            unit_cost=Decimal(str(line.unit_cost)),
            discount_amount=Decimal(str(line.discount_amount or 0)),
            tax_rate=Decimal(str(line.tax_rate or 0)),
        )
        line.tax_amount = float(totals.tax_amount)
        line.line_total = float(totals.line_total)
        # Relationship is kept in sync by the repository — refresh totals in place.
        if "lines" not in order.__dict__:
            self._db.expire(order, ["lines"])
            order = self.get_order(ctx, order_id)
        self._refresh_totals(order)
        self._db.flush()
        return line

    def add_lines(self, ctx: TenantContext, order_id: UUID, line_fields: list[dict]):
        """Insert many draft lines with one flush and one totals refresh.

        Returns ``(created_lines, order)``.
        """
        if not line_fields:
            order = self.get_order(ctx, order_id)
            return [], order
        order = self.get_order(ctx, order_id)
        if order.status != OrderStatus.DRAFT.value:
            raise InvalidDocumentState("Lines can only be added to draft orders")
        # Ensure collection is loaded so appends stay visible without expire_all.
        _ = list(order.lines or [])
        created = []
        for fields in line_fields:
            payload = dict(fields)
            currency = str(payload.get("rate_currency") or "INR").strip().upper() or "INR"
            payload["rate_currency"] = "USD" if currency == "USD" else "INR"
            if payload["rate_currency"] == "USD":
                payload["tax_rate"] = 0
            line = self._repo.add_line(ctx, order, flush=False, **payload)
            tax_rate = Decimal("0") if payload["rate_currency"] == "USD" else Decimal(
                str(getattr(line, "tax_rate", 0) or 0)
            )
            totals = LineTotals.compute(
                quantity=Decimal(str(line.quantity)),
                unit_cost=Decimal(str(line.unit_cost)),
                discount_amount=Decimal(str(getattr(line, "discount_amount", 0) or 0)),
                tax_rate=tax_rate,
            )
            line.tax_amount = float(totals.tax_amount)
            line.line_total = float(totals.line_total)
            created.append(line)
        self._db.flush()
        self._refresh_totals(order)
        self._db.flush()
        return created, order

    def replace_draft_lines(
        self, ctx: TenantContext, order_id: UUID, line_fields: list[dict]
    ):
        """Soft-delete existing draft lines and insert the replacement set."""
        order = self.get_order(ctx, order_id)
        if order.status != OrderStatus.DRAFT.value:
            raise InvalidDocumentState("Lines can only be replaced on draft orders")
        now = utcnow()
        for line in list(order.lines or []):
            if getattr(line, "is_deleted", False):
                continue
            line.is_deleted = True
            line.deleted_at = now
            line.deleted_by = ctx.user_id
        self._db.flush()
        if not line_fields:
            self._refresh_totals(order)
            self._db.flush()
            return [], order
        return self.add_lines(ctx, order_id, line_fields)

    def _refresh_totals(self, order: ProcOrderHeader) -> None:
        active = [ln for ln in order.lines if not getattr(ln, "is_deleted", False)]
        currencies = {
            "USD" if (getattr(ln, "rate_currency", None) or "INR").upper() == "USD" else "INR"
            for ln in active
        }
        all_usd = bool(active) and currencies == {"USD"}
        subtotal = Decimal("0")
        discount = Decimal("0")
        tax = Decimal("0")
        for line in active:
            currency = (getattr(line, "rate_currency", None) or "INR").upper()
            is_usd = currency == "USD"
            if is_usd and not all_usd:
                continue
            subtotal += Decimal(str(line.quantity)) * Decimal(str(line.unit_cost))
            discount += Decimal(str(line.discount_amount))
            if not is_usd:
                tax += Decimal(str(line.tax_amount))
        order.currency_code = "USD" if all_usd else "INR"
        order.subtotal_amount = float(subtotal.quantize(Decimal("0.0001")))
        order.discount_amount = float(discount.quantize(Decimal("0.0001")))
        order.tax_amount = float(tax.quantize(Decimal("0.0001")))
        order.total_amount = float((subtotal - discount + tax).quantize(Decimal("0.0001")))

    def submit(self, ctx: TenantContext, order_id: UUID):
        order = self.get_order(ctx, order_id)
        if order.status != OrderStatus.DRAFT.value:
            raise InvalidDocumentState("Only draft orders can be submitted")
        instance = self._governance.submit_for_approval(
            ctx, entity_name="proc_order_header", entity_id=order_id
        )
        return self._repo.update_order(
            ctx,
            order_id,
            status=OrderStatus.SUBMITTED.value,
            workflow_status=WorkflowStatus.IN_PROGRESS.value,
            workflow_instance_id=instance.id,
        )

    def approve(self, ctx: TenantContext, order_id: UUID):
        order = self.get_order(ctx, order_id)
        if order.created_by == ctx.user_id:
            raise SegregationOfDutiesError("Creator cannot approve own purchase order")
        if order.workflow_instance_id is None:
            raise InvalidDocumentState("Order has no workflow instance")

        def on_approved():
            self._repo.update_order(
                ctx,
                order_id,
                status=OrderStatus.APPROVED.value,
                workflow_status=WorkflowStatus.APPROVED.value,
            )

        return self._governance.approve(
            ctx,
            instance_id=order.workflow_instance_id,
            entity_name="proc_order_header",
            entity_id=order_id,
            on_approved=on_approved,
        )

    def send(self, ctx: TenantContext, order_id: UUID):
        order = self.get_order(ctx, order_id)
        if order.status != OrderStatus.APPROVED.value:
            raise InvalidDocumentState("Only approved orders can be sent to vendor")
        updated = self._repo.update_order(ctx, order_id, status=OrderStatus.SENT.value)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order_id,
            operation="send",
            performed_by=ctx.user_id,
        )
        return updated

    def cancel(self, ctx: TenantContext, order_id: UUID):
        order = self.get_order(ctx, order_id)
        if order.status in {
            OrderStatus.RECEIVED.value,
            OrderStatus.CLOSED.value,
            OrderStatus.CANCELLED.value,
        }:
            raise InvalidDocumentState("Order cannot be cancelled in its current state")
        return self._repo.update_order(ctx, order_id, status=OrderStatus.CANCELLED.value)
