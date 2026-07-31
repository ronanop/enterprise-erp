"""SalaryStructure application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.payroll.models import PaySalaryStructure
from modules.payroll.repository.salary_structure_repository import SalaryStructureRepository
from modules.payroll.service.engines import SalaryStructureEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class SalaryStructureService:
    def __init__(self, db: Session) -> None:
        self._repo = SalaryStructureRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._engine = SalaryStructureEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PaySalaryStructure:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("SalaryStructure not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        if not fields.get("structure_code"):
            import uuid as _uuid

            fields["structure_code"] = f"STR-{str(_uuid.uuid4())[:8].upper()}"
        fields.setdefault("currency_code", "INR")
        fields.setdefault("status", "active")
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_salary_structure",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("SalaryStructure not found")
        return row
