"""Master Data port — create employee only at onboarding complete."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.employee_service import EmployeeService


class RecruitmentMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._employees = EmployeeService(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)

    def create_employee(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        department_id: UUID,
        first_name: str,
        last_name: str,
        email: str,
        mobile: str,
        designation: str,
        date_of_joining: date,
        company_id: UUID | None = None,
        employee_code: str | None = None,
    ):
        return self._employees.create_employee(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            department_id=department_id,
            employee_code=employee_code,
            first_name=first_name,
            last_name=last_name,
            email=email,
            mobile=mobile,
            designation=designation,
            date_of_joining=date_of_joining,
            hire_source="recruitment_onboarding",
        )
