"""Payroll PayPayrollRunLine repository."""

from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.models import PayPayrollRunLine
from modules.payroll.repository.base import PayScopedRepository, utcnow


class PayrollRunLineRepository(PayScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayPayrollRunLine | None:
        stmt = select(PayPayrollRunLine).where(PayPayrollRunLine.id == row_id, PayPayrollRunLine.is_deleted.is_(False))
        stmt = self.apply_pay_filter(stmt, PayPayrollRunLine, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(PayPayrollRunLine).where(
            PayPayrollRunLine.company_id == company_id,
            PayPayrollRunLine.is_deleted.is_(False),
        )
        stmt = self.apply_pay_filter(stmt, PayPayrollRunLine, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> PayPayrollRunLine:
        row = PayPayrollRunLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PayPayrollRunLine | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    def count_by_employee_salary(self, ctx: TenantContext, employee_salary_id: UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(PayPayrollRunLine)
            .where(
                PayPayrollRunLine.employee_salary_id == employee_salary_id,
                PayPayrollRunLine.is_deleted.is_(False),
            )
        )
        stmt = self.apply_pay_filter(stmt, PayPayrollRunLine, ctx, branch_scoped=True)
        return int(self.db.scalar(stmt) or 0)
