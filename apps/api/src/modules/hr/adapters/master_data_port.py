"""Master Data port — HR never ORM-writes master_* tables."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.domain.enums import EmployeeStatus
from modules.master_data.service.employee_service import EmployeeService


class HrMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._employees = EmployeeService(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)

    def get_employee_by_code(self, ctx: TenantContext, company_id: UUID, employee_code: str):
        return self._employees.get_employee_by_code(ctx, company_id, employee_code)

    def sync_designation_label(self, ctx: TenantContext, employee_id: UUID, designation: str):
        return self._employees.update_employee(ctx, employee_id, designation=designation)

    def complete_separation_identity(
        self,
        ctx: TenantContext,
        employee_id: UUID,
        *,
        separation_type: str,
        date_of_leaving: date,
    ):
        status = EmployeeStatus.RESIGNED.value
        if separation_type == "termination":
            status = EmployeeStatus.TERMINATED.value
        return self._employees.update_employee(
            ctx,
            employee_id,
            status=status,
            date_of_leaving=date_of_leaving,
        )

    def update_employee_status(self, ctx: TenantContext, employee_id: UUID, status: str):
        return self._employees.update_employee(ctx, employee_id, status=status)
