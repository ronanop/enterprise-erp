"""EmployeeSalary application service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.payroll.domain.exceptions import InvalidEmployeeSalaryState
from modules.payroll.models import PayEmployeeSalary
from modules.payroll.repository.employee_salary_component_repository import (
    EmployeeSalaryComponentRepository,
)
from modules.payroll.repository.employee_salary_repository import EmployeeSalaryRepository
from modules.payroll.repository.payroll_run_line_repository import PayrollRunLineRepository
from modules.payroll.adapters.master_data_port import PayrollMasterDataAdapter
from modules.payroll.schemas import EmployeeSalaryResponse
from modules.payroll.service.engines import EmployeeSalaryEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class EmployeeSalaryService:
    def __init__(self, db: Session) -> None:
        self._repo = EmployeeSalaryRepository(db)
        self._components = EmployeeSalaryComponentRepository(db)
        self._run_lines = PayrollRunLineRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._engine = EmployeeSalaryEngine()
        self._audit = AuditService(db)
        self._master = PayrollMasterDataAdapter(db)

    def _to_response(self, row: PayEmployeeSalary, labels: dict[UUID, tuple[str, str]]) -> EmployeeSalaryResponse:
        payload = EmployeeSalaryResponse.model_validate(row)
        code, name = labels.get(row.employee_id, (None, None))
        payload.employee_code = code
        payload.employee_name = name
        return payload

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_rows(ctx, cid)
        labels = self._master.employee_labels(ctx, [row.employee_id for row in rows])
        return [self._to_response(row, labels) for row in rows]

    def get(self, ctx: TenantContext, row_id: UUID) -> PayEmployeeSalary:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("EmployeeSalary not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, *, branch_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)

        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        if not fields.get("document_number"):
            import uuid as _uuid

            fields["document_number"] = f"ESAL-{str(_uuid.uuid4())[:8].upper()}"
        fields.setdefault("currency_code", "INR")
        fields.setdefault("status", "active")

        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_employee_salary",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("EmployeeSalary not found")
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        row = self.get(ctx, row_id)
        used = self._run_lines.count_by_employee_salary(ctx, row_id)
        if used > 0:
            raise InvalidEmployeeSalaryState(
                f"Cannot delete salary assignment used on {used} payroll run line(s)"
            )
        for component in self._components.list_for_salary(ctx, row_id):
            self._components.soft_delete(ctx, component.id)
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("EmployeeSalary not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_employee_salary",
            entity_id=row.id,
            operation="delete",
            performed_by=ctx.user_id,
        )
