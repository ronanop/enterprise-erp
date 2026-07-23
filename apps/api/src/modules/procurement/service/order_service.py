"""Purchase order service."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.procurement.domain.enums import OrderStatus, ProcEntityType
from modules.procurement.domain.exceptions import InvalidDocumentState, SegregationOfDutiesError
from modules.procurement.domain.value_objects import LineTotals
from modules.procurement.models.order import ProcOrderHeader
from modules.procurement.repository.order_repository import OrderRepository
from modules.procurement.service.document_number_service import DocumentNumberService
from modules.procurement.service.engines.order_engine import OrderEngine
from modules.procurement.service.governance_service import ProcurementGovernanceService
from modules.procurement.service.procurement_scope_validator import ProcurementScopeValidator


class OrderService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = OrderRepository(db)
        self._scope = ProcurementScopeValidator(db)
        self._engine = OrderEngine()
        self._numbers = DocumentNumberService(db)
        self._governance = ProcurementGovernanceService(db)
        self._audit = AuditService(db)

    def list_orders(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_orders(ctx, cid)

    def get_order(self, ctx: TenantContext, order_id: UUID) -> ProcOrderHeader:
        row = self._repo.get_order(ctx, order_id)
        if row is None:
            raise NotFoundException("Purchase order not found")
        self._scope.validate_company_access(ctx, row.company_id)
        self._scope.validate_branch_access(ctx, row.branch_id)
        return row

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
            discount_amount=Decimal(str(line.discount_amount)),
            tax_rate=Decimal(str(line.tax_rate)),
        )
        line.tax_amount = float(totals.tax_amount)
        line.line_total = float(totals.line_total)
        order = self.get_order(ctx, order_id)
        self._refresh_totals(order)
        self._db.flush()
        return line

    def _refresh_totals(self, order: ProcOrderHeader) -> None:
        active = [ln for ln in order.lines if not getattr(ln, "is_deleted", False)]
        subtotal = Decimal("0")
        discount = Decimal("0")
        tax = Decimal("0")
        for line in active:
            subtotal += Decimal(str(line.quantity)) * Decimal(str(line.unit_cost))
            discount += Decimal(str(line.discount_amount))
            tax += Decimal(str(line.tax_amount))
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
