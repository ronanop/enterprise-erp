"""Master Data port - Payroll never ORM-writes master_* tables."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.employee_service import EmployeeService


class PayrollMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._employees = EmployeeService(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)
