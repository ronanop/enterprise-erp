"""Employee profile application service."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.repository.employee_profile_repository import EmployeeProfileRepository
from modules.hr.schemas import EmployeeProfileResponse
from modules.hr.service.engines import EmployeeProfileEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator
from modules.master_data.models.employee import MasterEmployee


class EmployeeProfileService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = EmployeeProfileRepository(db)
        self._scope = HrScopeValidator(db)
        self._engine = EmployeeProfileEngine()
        self._master = HrMasterDataAdapter(db)
        self._audit = AuditService(db)

    def _enrich(self, row) -> EmployeeProfileResponse:
        emp = self._db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.id == row.employee_id,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        payload = EmployeeProfileResponse.model_validate(row)
        if emp is not None:
            payload.employee_code = emp.employee_code
            payload.first_name = emp.first_name
            payload.last_name = emp.last_name
            payload.employee_name = f"{emp.first_name} {emp.last_name}".strip()
            payload.email = emp.email
            payload.designation = emp.designation
        return payload

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return [self._enrich(row) for row in self._repo.list_rows(ctx, cid)]

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Employee profile not found")
        return self._enrich(row)

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        company_id: UUID | None = None,
        **fields,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            **fields,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_employee_profile",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return self._enrich(row)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        orm = self._repo.get(ctx, row_id)
        if orm is None:
            raise NotFoundException("Employee profile not found")
        self._engine.validate_writable(orm)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Employee profile not found")
        return self._enrich(updated)
