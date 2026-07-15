"""Payroll port — read-only labor hint stub; no pay_* writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class GrcPayrollAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID) -> None:
        _ = (ctx, employee_id, self._db)
        return None
