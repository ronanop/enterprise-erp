"""PayrollRunLine application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.payroll.models import PayPayrollRunLine
from modules.payroll.repository.payroll_run_line_repository import PayrollRunLineRepository
from modules.payroll.service.engines import PayrollRunLineEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class PayrollRunLineService:
    def __init__(self, db: Session) -> None:
        self._repo = PayrollRunLineRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._engine = PayrollRunLineEngine()
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayPayrollRunLine:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("PayrollRunLine not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, *, branch_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)

        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_payroll_run_line",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("PayrollRunLine not found")
        return row
