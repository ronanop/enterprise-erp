"""Employee service."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.master_data.domain.enums import MasterEntityType
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.repository.employee_repository import EmployeeRepository
from modules.master_data.service.code_generator_service import CodeGeneratorService
from modules.master_data.service.duplicate_checker_service import DuplicateCheckerService
from modules.master_data.service.governance_service import GovernanceService
from modules.master_data.service.master_scope_validator import MasterScopeValidator
from modules.organization.repository.hierarchy_repository import DepartmentRepository


class EmployeeService:
    def __init__(self, db: Session) -> None:
        self._repo = EmployeeRepository(db)
        self._departments = DepartmentRepository(db)
        self._audit = AuditService(db)
        self._codes = CodeGeneratorService(db)
        self._duplicates = DuplicateCheckerService(db)
        self._scope = MasterScopeValidator(db)
        self._governance = GovernanceService(db)

    def list_employees(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ):
        if company_id:
            self._scope.validate_company_access(ctx, company_id)
        if branch_id:
            self._scope.validate_branch_access(ctx, branch_id)
        return self._repo.list_employees(ctx, company_id=company_id, branch_id=branch_id)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        employee = self._repo.get_by_id(ctx, employee_id)
        if employee is None:
            raise NotFoundException("Employee not found")
        self._scope.validate_company_access(ctx, employee.company_id)
        self._scope.validate_branch_access(ctx, employee.branch_id)
        return employee

    def get_employee_by_code(self, ctx: TenantContext, company_id: UUID, employee_code: str):
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.get_by_code(ctx, cid, employee_code)
        if row is None:
            raise NotFoundException(f"Employee code '{employee_code}' not found")
        return self.get_employee(ctx, row.id)

    def create_employee(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID,
        department_id: UUID,
        employee_code: str | None = None,
        first_name: str,
        last_name: str,
        email: str,
        mobile: str,
        designation: str,
        date_of_joining: date,
        reporting_manager_id: UUID | None = None,
        date_of_leaving: date | None = None,
        user_id: UUID | None = None,
        hire_source: str = "direct",
        bypass_onboarding: bool = False,
    ):
        if hire_source != "recruitment_onboarding" and not bypass_onboarding:
            raise ConflictException(
                "Employees must be hired via completed recruitment onboarding "
                "(POST /recruitment/onboarding/{id}/complete). "
                "Direct workforce create is blocked. "
                "For data migration only, pass bypass_onboarding=true."
            )
        resolved_company_id = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._validate_department_scope(ctx, branch_id, department_id)

        if employee_code is None:
            employee_code = self._codes.generate(
                MasterEntityType.EMPLOYEE,
                resolved_company_id,
                model=MasterEmployee,
                code_column="employee_code",
            )
        else:
            self._duplicates.ensure_unique_code(
                model=MasterEmployee,
                company_id=resolved_company_id,
                code=employee_code,
                code_field="employee_code",
                label="Employee",
            )
        self._duplicates.ensure_unique_email(
            model=MasterEmployee,
            company_id=resolved_company_id,
            email=email,
        )

        employee = self._repo.create(
            ctx,
            company_id=resolved_company_id,
            branch_id=branch_id,
            department_id=department_id,
            employee_code=employee_code,
            first_name=first_name,
            last_name=last_name,
            email=email,
            mobile=mobile,
            designation=designation,
            date_of_joining=date_of_joining,
            reporting_manager_id=reporting_manager_id,
            date_of_leaving=date_of_leaving,
            user_id=user_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="master_employee",
            entity_id=employee.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "employee_code": employee_code,
                "branch_id": str(branch_id),
                "hire_source": hire_source,
            },
        )
        return employee

    def update_employee(self, ctx: TenantContext, employee_id: UUID, **fields):
        employee = self.get_employee(ctx, employee_id)
        if "branch_id" in fields and fields["branch_id"] is not None:
            self._scope.validate_branch_access(ctx, fields["branch_id"])
        if "department_id" in fields and fields["department_id"] is not None:
            branch_id = fields.get("branch_id", employee.branch_id)
            self._validate_department_scope(ctx, branch_id, fields["department_id"])
        if "email" in fields and fields["email"] is not None:
            self._duplicates.ensure_unique_email(
                model=MasterEmployee,
                company_id=employee.company_id,
                email=fields["email"],
                exclude_id=employee_id,
            )
        if "employee_code" in fields and fields["employee_code"] is not None:
            self._duplicates.ensure_unique_code(
                model=MasterEmployee,
                company_id=employee.company_id,
                code=str(fields["employee_code"]).strip().upper(),
                code_field="employee_code",
                label="Employee",
                exclude_id=employee_id,
            )
            fields["employee_code"] = str(fields["employee_code"]).strip().upper()

        updated = self._repo.update(ctx, employee_id, **fields)
        if updated is None:
            raise NotFoundException("Employee not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="master_employee",
            entity_id=employee_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=fields,
        )
        return updated

    def delete_employee(self, ctx: TenantContext, employee_id: UUID) -> None:
        self.get_employee(ctx, employee_id)
        if not self._repo.soft_delete(ctx, employee_id):
            raise NotFoundException("Employee not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="master_employee",
            entity_id=employee_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def submit_for_approval(self, ctx: TenantContext, employee_id: UUID):
        self.get_employee(ctx, employee_id)
        return self._governance.submit_for_approval(
            ctx,
            entity_name="master_employee",
            entity_id=employee_id,
        )

    def _validate_department_scope(
        self, ctx: TenantContext, branch_id: UUID, department_id: UUID
    ) -> None:
        department = self._departments.get_by_id(ctx, department_id)
        if department is None:
            raise NotFoundException("Department not found")
        if department.branch_id != branch_id:
            raise ConflictException("Department does not belong to the specified branch")
