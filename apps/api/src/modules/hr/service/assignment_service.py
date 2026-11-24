"""Department / designation assignment services."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.adapters.organization_port import HrOrganizationAdapter
from modules.hr.repository.department_assignment_repository import DepartmentAssignmentRepository
from modules.hr.repository.designation_assignment_repository import DesignationAssignmentRepository
from modules.hr.repository.designation_repository import DesignationRepository
from modules.hr.service.engines import DepartmentAssignmentEngine, DesignationAssignmentEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator


class DepartmentAssignmentService:
    def __init__(self, db: Session) -> None:
        self._repo = DepartmentAssignmentRepository(db)
        self._scope = HrScopeValidator(db)
        self._org = HrOrganizationAdapter(db)
        self._master = HrMasterDataAdapter(db)
        self._engine = DepartmentAssignmentEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Department assignment not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        department_id: UUID,
        effective_from: date,
        company_id: UUID | None = None,
        **fields,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        self._org.get_department(ctx, department_id)
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            department_id=department_id,
            effective_from=effective_from,
            **fields,
        )

    def end(self, ctx: TenantContext, row_id: UUID, *, effective_to: date | None = None):
        row = self.get(ctx, row_id)
        self._engine.end(row)
        return self._repo.update(
            ctx,
            row_id,
            status=row.status,
            effective_to=effective_to or date.today(),
        )


class DesignationAssignmentService:
    def __init__(self, db: Session) -> None:
        self._repo = DesignationAssignmentRepository(db)
        self._designations = DesignationRepository(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._engine = DesignationAssignmentEngine()
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Designation assignment not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        designation_id: UUID,
        effective_from: date,
        company_id: UUID | None = None,
        sync_master_label: bool = True,
        **fields,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        designation = self._designations.get(ctx, designation_id)
        if designation is None:
            raise NotFoundException("Designation not found")
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            designation_id=designation_id,
            effective_from=effective_from,
            **fields,
        )
        if sync_master_label and fields.get("is_primary", True):
            self._master.sync_designation_label(ctx, employee_id, designation.designation_name)
        return row

    def end(self, ctx: TenantContext, row_id: UUID, *, effective_to: date | None = None):
        row = self.get(ctx, row_id)
        self._engine.end(row)
        return self._repo.update(
            ctx,
            row_id,
            status=row.status,
            effective_to=effective_to or date.today(),
        )
