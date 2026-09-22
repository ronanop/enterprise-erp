"""PayrollAdjustment application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.payroll.domain.enums import PayEntityType
from modules.payroll.models import PayPayrollAdjustment
from modules.payroll.repository.payroll_adjustment_repository import PayrollAdjustmentRepository
from modules.payroll.service.document_number_service import DocumentNumberService
from modules.payroll.service.engines import PayrollAdjustmentEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class PayrollAdjustmentService:
    def __init__(self, db: Session) -> None:
        self._repo = PayrollAdjustmentRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = PayrollAdjustmentEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayPayrollAdjustment:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("PayrollAdjustment not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, *, branch_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)

        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        doc = self._numbers.generate(
            PayEntityType.PAYROLL_ADJUSTMENT, cid, PayPayrollAdjustment, "document_number"
        )
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            **fields,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_payroll_adjustment",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("PayrollAdjustment not found")
        return row

    def apply(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.apply(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_payroll_adjustment",
            entity_id=row_id,
            operation="apply",
            performed_by=ctx.user_id,
        )
        return updated or row
