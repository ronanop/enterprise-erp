"""Payroll port — read-only labor hint stub; no pay_* writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class HelpdeskPayrollAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID) -> dict:
        _ = (ctx, employee_id, self._db)
        return {"read_only": True, "source": "payroll_stub"}
