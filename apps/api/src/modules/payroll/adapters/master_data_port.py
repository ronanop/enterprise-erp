"""Master Data port — Payroll never ORM-writes master_* tables."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.employee_service import EmployeeService


class PayrollMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._employees = EmployeeService(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)

    def employee_labels(self, ctx: TenantContext, employee_ids: list[UUID]) -> dict[UUID, tuple[str, str]]:
        wanted = {eid for eid in employee_ids if eid is not None}
        if not wanted:
            return {}
        labels: dict[UUID, tuple[str, str]] = {}
        for emp in self._employees.list_employees(ctx):
            if emp.id not in wanted:
                continue
            name = f"{emp.first_name} {emp.last_name}".strip()
            labels[emp.id] = (emp.employee_code, name)
            if len(labels) == len(wanted):
                break
        return labels
