"""Payroll port — optional read-only labor cost hint; no pay_* writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.repository.employee_salary_repository import EmployeeSalaryRepository


class ServicePayrollAdapter:
    def __init__(self, db: Session) -> None:
        self._salaries = EmployeeSalaryRepository(db)

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID):
        rows = self._salaries.list_rows(ctx, ctx.company_id) if ctx.company_id else []
        for row in rows:
            if getattr(row, "employee_id", None) == employee_id and not getattr(
                row, "is_deleted", False
            ):
                return {
                    "employee_id": employee_id,
                    "salary_id": row.id,
                    "status": getattr(row, "status", None),
                }
        return {"employee_id": employee_id, "hint": None}
