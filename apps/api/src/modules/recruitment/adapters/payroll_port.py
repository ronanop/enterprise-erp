"""Payroll port - read-only salary structure hints; no pay_* writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.repository.salary_structure_repository import SalaryStructureRepository


class RecruitmentPayrollAdapter:
    def __init__(self, db: Session) -> None:
        self._structures = SalaryStructureRepository(db)

    def get_salary_structure(self, ctx: TenantContext, salary_structure_id: UUID):
        row = self._structures.get(ctx, salary_structure_id)
        if row is None:
            raise NotFoundException("Salary structure not found")
        return row
