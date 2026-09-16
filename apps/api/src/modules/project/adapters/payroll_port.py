"""Payroll port - optional read-only labor cost hint; no pay_* writes."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.models import PayEmployeeSalary


class ProjectPayrollAdapter:
    def __init__(self, db: Session) -> None:
        self.db = db

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID):
        stmt = select(PayEmployeeSalary).where(
            PayEmployeeSalary.tenant_id == ctx.tenant_id,
            PayEmployeeSalary.employee_id == employee_id,
            PayEmployeeSalary.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        if row is None:
            return {"employee_id": employee_id, "hint": None}
        return {
            "employee_id": employee_id,
            "salary_id": row.id,
            "status": getattr(row, "status", None),
        }
