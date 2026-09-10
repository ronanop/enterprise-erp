"""Quality inspection services."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.quality.adapters.inventory_port import QualityInventoryAdapter
from modules.quality.domain.entities import DispositionQty, normalize_pass_fail
from modules.quality.domain.enums import (
    SOURCE_MODULE,
    FinalResult,
    FinalStatus,
    IncomingResult,
    IncomingStatus,
    InProcessResult,
    InProcessStatus,
    QmEntityType,
)
from modules.quality.models import QmFinalInspection, QmIncomingInspection, QmInprocessInspection
from modules.quality.repository.final_inspection_repository import FinalInspectionRepository
from modules.quality.repository.incoming_inspection_repository import IncomingInspectionRepository
from modules.quality.repository.inprocess_inspection_repository import InprocessInspectionRepository
from modules.quality.service.document_number_service import DocumentNumberService
from modules.quality.service.engines import (
    FinalInspectionEngine,
    IncomingInspectionEngine,
    InprocessInspectionEngine,
)
from modules.quality.service.posting_service import QualityPostingService
from modules.quality.service.qm_scope_validator import QmScopeValidator


def _decimal_qty(value: object | None, default: Decimal = Decimal("0")) -> Decimal:
    if value is None:
        return default
    return Decimal(str(value))


def _validate_disposition(
    inspected_qty: Decimal,
    accepted_qty: Decimal,
    rejected_qty: Decimal,
) -> None:
    disposition = DispositionQty(
        inspected_qty=inspected_qty,
        accepted_qty=accepted_qty,
        rejected_qty=rejected_qty,
    )
    if not disposition.validate():
        raise ValidationException(disposition.error_message())


def _normalize_incoming_line(line: dict) -> dict:
    normalized = dict(line)
    normalized["pass_fail"] = normalize_pass_fail(line.get("pass_fail"))
    if normalized.get("measured_value") is not None:
        normalized["measured_value"] = Decimal(str(normalized["measured_value"]))
    return normalized


class IncomingInspectionService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = IncomingInspectionRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = IncomingInspectionEngine()
        self._inv = QualityInventoryAdapter(db)
        self._posting = QualityPostingService(db)
        self._scope = QmScopeValidator(db)
        self._audit = AuditService(db)

    def list_inspections(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_inspections(ctx, cid)

    def get_inspection(self, ctx: TenantContext, inspection_id: UUID) -> QmIncomingInspection:
        row = self._repo.get(ctx, inspection_id)
        if row is None:
            raise NotFoundException("Incoming inspection not found")
        return row

    def create_inspection(
        self, ctx: TenantContext, *, lines: list[dict] | None = None, **fields
    ) -> QmIncomingInspection:
        company_id = fields.pop("company_id")
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        self._scope.validate_company_access(ctx, company_id)
        number = self._numbers.generate(
            QmEntityType.INCOMING_INSPECTION,
            company_id,
            model=QmIncomingInspection,
            code_column="document_number",
        )
        inspected_qty = _decimal_qty(fields.get("inspected_qty"))
        accepted_qty = _decimal_qty(fields.get("accepted_qty"))
        rejected_qty = _decimal_qty(fields.get("rejected_qty"))
        _validate_disposition(inspected_qty, accepted_qty, rejected_qty)
        fields["inspected_qty"] = inspected_qty
        fields["accepted_qty"] = accepted_qty
        fields["rejected_qty"] = rejected_qty
        document_date = fields.pop("document_date", None) or date.today()
        header = self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=document_date,
            status=IncomingStatus.DRAFT.value,
            result=IncomingResult.PENDING.value,
            source_module=SOURCE_MODULE,
            **fields,
        )
        for i, ln in enumerate(lines or [], start=1):
            line = _normalize_incoming_line(ln)
            self._repo.add_line(
                ctx,
                header,
                line_number=line.get("line_number", i),
                characteristic_id=line["characteristic_id"],
                measured_value=line.get("measured_value"),
                measured_text=line.get("measured_text"),
                pass_fail=line.get("pass_fail"),
                is_out_of_spec=bool(line.get("is_out_of_spec", False)),
                defect_type_id=line.get("defect_type_id"),
                notes=line.get("notes"),
                status=line.get("status", "pending"),
            )
        inspected = Decimal(str(header.inspected_qty or 0))
        if inspected > 0 and header.warehouse_id and header.product_id and header.uom_id:
            result = self._inv.quarantine_stock(
                ctx,
                company_id=header.company_id,
                branch_id=header.branch_id,
                warehouse_id=header.warehouse_id,
                product_id=header.product_id,
                uom_id=header.uom_id,
                quantity=inspected,
                source_document_id=header.id,
            )
            header.inventory_event_id = getattr(result, "ledger_id", None)
        return self.get_inspection(ctx, header.id)

    def update_inspection(
        self, ctx: TenantContext, inspection_id: UUID, **fields
    ) -> QmIncomingInspection:
        inspection = self.get_inspection(ctx, inspection_id)
        if inspection.status not in {IncomingStatus.DRAFT.value, IncomingStatus.IN_PROGRESS.value}:
            fields = {k: v for k, v in fields.items() if k in {"inspector_employee_id"}}
        for key in ("inspected_qty", "accepted_qty", "rejected_qty"):
            if fields.get(key) is not None:
                fields[key] = _decimal_qty(fields[key])
        if any(k in fields for k in ("inspected_qty", "accepted_qty", "rejected_qty")):
            inspected_qty = _decimal_qty(fields.get("inspected_qty", inspection.inspected_qty))
            accepted_qty = _decimal_qty(fields.get("accepted_qty", inspection.accepted_qty))
            rejected_qty = _decimal_qty(fields.get("rejected_qty", inspection.rejected_qty))
            _validate_disposition(inspected_qty, accepted_qty, rejected_qty)
            fields["inspected_qty"] = inspected_qty
            fields["accepted_qty"] = accepted_qty
            fields["rejected_qty"] = rejected_qty
        row = self._repo.update(ctx, inspection_id, **fields)
        assert row is not None
        return self.get_inspection(ctx, inspection_id)

    def add_lines(
        self, ctx: TenantContext, inspection_id: UUID, lines: list[dict]
    ) -> QmIncomingInspection:
        inspection = self.get_inspection(ctx, inspection_id)
        if inspection.status not in {IncomingStatus.DRAFT.value, IncomingStatus.IN_PROGRESS.value}:
            raise ValidationException("Checklist lines can only be added while the inspection is draft or in progress")
        if not lines:
            raise ValidationException("At least one checklist line is required")
        existing = [ln for ln in (inspection.lines or []) if not getattr(ln, "is_deleted", False)]
        next_no = max((int(ln.line_number) for ln in existing), default=0) + 1
        for i, raw in enumerate(lines):
            line = _normalize_incoming_line(raw)
            self._repo.add_line(
                ctx,
                inspection,
                line_number=line.get("line_number") or (next_no + i),
                characteristic_id=line["characteristic_id"],
                measured_value=line.get("measured_value"),
                measured_text=line.get("measured_text"),
                pass_fail=line.get("pass_fail"),
                is_out_of_spec=bool(line.get("is_out_of_spec", False)),
                defect_type_id=line.get("defect_type_id"),
                notes=line.get("notes"),
                status=line.get("status", "pending"),
            )
        return self.get_inspection(ctx, inspection_id)

    def _apply_inventory_disposition(self, ctx: TenantContext, inspection: QmIncomingInspection) -> None:
        if not (inspection.warehouse_id and inspection.product_id and inspection.uom_id):
            return
        accepted = Decimal(str(inspection.accepted_qty or 0))
        rejected = Decimal(str(inspection.rejected_qty or 0))
        if accepted > 0:
            result = self._inv.release_stock(
                ctx,
                company_id=inspection.company_id,
                branch_id=inspection.branch_id,
                warehouse_id=inspection.warehouse_id,
                product_id=inspection.product_id,
                uom_id=inspection.uom_id,
                quantity=accepted,
                source_document_id=inspection.id,
            )
            inspection.inventory_event_id = getattr(result, "ledger_id", None)
        if rejected > 0:
            self._inv.reject_stock(
                ctx,
                company_id=inspection.company_id,
                branch_id=inspection.branch_id,
                warehouse_id=inspection.warehouse_id,
                product_id=inspection.product_id,
                uom_id=inspection.uom_id,
                quantity=rejected,
                source_document_id=inspection.id,
                issue_from_quarantine=accepted == 0,
            )

    def complete(self, ctx: TenantContext, inspection_id: UUID) -> QmIncomingInspection:
        inspection = self.get_inspection(ctx, inspection_id)
        self._engine.apply_complete(inspection)
        self._apply_inventory_disposition(ctx, inspection)
        self._repo.update(ctx, inspection_id, status=inspection.status, result=inspection.result)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_incoming_inspection",
            entity_id=inspection_id,
            operation="complete",
            performed_by=ctx.user_id,
        )
        return self.get_inspection(ctx, inspection_id)

    def approve(
        self,
        ctx: TenantContext,
        inspection_id: UUID,
        *,
        quality_expense_account_id: UUID | None = None,
        inventory_account_id: UUID | None = None,
        amount: Decimal | None = None,
        fiscal_year_id: UUID | None = None,
    ) -> QmIncomingInspection:
        inspection = self.get_inspection(ctx, inspection_id)
        self._engine.validate_approvable(inspection)
        self._apply_inventory_disposition(ctx, inspection)
        if (
            quality_expense_account_id
            and inventory_account_id
            and amount
            and inspection.period_id
            and inspection.result == IncomingResult.REJECTED.value
        ):
            self._posting.post_quality_cost(
                ctx,
                inspection,
                amount=Decimal(str(amount)),
                quality_expense_account_id=quality_expense_account_id,
                inventory_account_id=inventory_account_id,
                fiscal_year_id=fiscal_year_id,
            )
        self._repo.update(ctx, inspection_id, workflow_status="approved")
        return self.get_inspection(ctx, inspection_id)


class InProcessInspectionService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = InprocessInspectionRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = InprocessInspectionEngine()
        self._scope = QmScopeValidator(db)

    def list_inspections(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_inspections(ctx, cid)

    def get_inspection(self, ctx: TenantContext, inspection_id: UUID) -> QmInprocessInspection:
        row = self._repo.get(ctx, inspection_id)
        if row is None:
            raise NotFoundException("In-process inspection not found")
        return row

    def create_inspection(self, ctx: TenantContext, **fields) -> QmInprocessInspection:
        company_id = fields.pop("company_id")
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        self._scope.validate_company_access(ctx, company_id)
        number = self._numbers.generate(
            QmEntityType.INPROCESS_INSPECTION,
            company_id,
            model=QmInprocessInspection,
            code_column="document_number",
        )
        document_date = fields.pop("document_date", None) or date.today()
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=document_date,
            status=InProcessStatus.DRAFT.value,
            result=InProcessResult.PENDING.value,
            source_module=fields.pop("source_module", "manufacturing"),
            **fields,
        )

    def update_inspection(
        self, ctx: TenantContext, inspection_id: UUID, **fields
    ) -> QmInprocessInspection:
        inspection = self.get_inspection(ctx, inspection_id)
        if inspection.status != InProcessStatus.DRAFT.value:
            fields = {k: v for k, v in fields.items() if k in {"inspector_employee_id", "result"}}
        row = self._repo.update(ctx, inspection_id, **fields)
        assert row is not None
        return row

    def complete(self, ctx: TenantContext, inspection_id: UUID) -> QmInprocessInspection:
        inspection = self.get_inspection(ctx, inspection_id)
        self._engine.apply_complete(inspection)
        self._repo.update(ctx, inspection_id, status=inspection.status)
        return self.get_inspection(ctx, inspection_id)


class FinalInspectionService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = FinalInspectionRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = FinalInspectionEngine()
        self._inv = QualityInventoryAdapter(db)
        self._posting = QualityPostingService(db)
        self._scope = QmScopeValidator(db)

    def list_inspections(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_inspections(ctx, cid)

    def get_inspection(self, ctx: TenantContext, inspection_id: UUID) -> QmFinalInspection:
        row = self._repo.get(ctx, inspection_id)
        if row is None:
            raise NotFoundException("Final inspection not found")
        return row

    def create_inspection(self, ctx: TenantContext, **fields) -> QmFinalInspection:
        company_id = fields.pop("company_id")
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        self._scope.validate_company_access(ctx, company_id)
        number = self._numbers.generate(
            QmEntityType.FINAL_INSPECTION,
            company_id,
            model=QmFinalInspection,
            code_column="document_number",
        )
        if fields.get("inspected_qty") is not None:
            fields["inspected_qty"] = Decimal(str(fields["inspected_qty"]))
        document_date = fields.pop("document_date", None) or date.today()
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=document_date,
            status=FinalStatus.DRAFT.value,
            result=FinalResult.PENDING.value,
            source_module=fields.pop("source_module", "manufacturing"),
            **fields,
        )

    def update_inspection(self, ctx: TenantContext, inspection_id: UUID, **fields) -> QmFinalInspection:
        inspection = self.get_inspection(ctx, inspection_id)
        if inspection.status != FinalStatus.DRAFT.value:
            fields = {k: v for k, v in fields.items() if k in {"inspector_employee_id", "result"}}
        if fields.get("inspected_qty") is not None:
            fields["inspected_qty"] = Decimal(str(fields["inspected_qty"]))
        row = self._repo.update(ctx, inspection_id, **fields)
        assert row is not None
        return row

    def submit(self, ctx: TenantContext, inspection_id: UUID) -> QmFinalInspection:
        inspection = self.get_inspection(ctx, inspection_id)
        self._engine.apply_submit(inspection)
        self._repo.update(ctx, inspection_id, status=inspection.status)
        return self.get_inspection(ctx, inspection_id)

    def approve(self, ctx: TenantContext, inspection_id: UUID) -> QmFinalInspection:
        inspection = self.get_inspection(ctx, inspection_id)
        self._engine.apply_approve(inspection)
        if (
            inspection.warehouse_id
            and inspection.product_id
            and inspection.uom_id
            and inspection.result == FinalResult.APPROVED.value
        ):
            qty = Decimal(str(inspection.inspected_qty or 0))
            if qty > 0:
                result = self._inv.release_stock(
                    ctx,
                    company_id=inspection.company_id,
                    branch_id=inspection.branch_id,
                    warehouse_id=inspection.warehouse_id,
                    product_id=inspection.product_id,
                    uom_id=inspection.uom_id,
                    quantity=qty,
                    source_document_id=inspection.id,
                )
                inspection.inventory_event_id = getattr(result, "ledger_id", None)
        self._repo.update(ctx, inspection_id, status=inspection.status)
        return self.get_inspection(ctx, inspection_id)

    def complete(
        self,
        ctx: TenantContext,
        inspection_id: UUID,
        *,
        scrap_expense_account_id: UUID | None = None,
        inventory_account_id: UUID | None = None,
        amount: Decimal | None = None,
        fiscal_year_id: UUID | None = None,
    ) -> QmFinalInspection:
        inspection = self.get_inspection(ctx, inspection_id)
        self._engine.apply_complete(inspection)
        if (
            scrap_expense_account_id
            and inventory_account_id
            and amount
            and inspection.period_id
            and inspection.result == FinalResult.REJECTED.value
        ):
            self._posting.post_scrap_cost(
                ctx,
                inspection,
                amount=Decimal(str(amount)),
                scrap_expense_account_id=scrap_expense_account_id,
                inventory_account_id=inventory_account_id,
                fiscal_year_id=fiscal_year_id,
            )
        self._repo.update(ctx, inspection_id, status=inspection.status)
        return self.get_inspection(ctx, inspection_id)
