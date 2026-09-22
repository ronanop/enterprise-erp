"""Payroll PayPayrollPeriod repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.models import PayPayrollPeriod
from modules.payroll.repository.base import PayScopedRepository, utcnow


class PayrollPeriodRepository(PayScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayPayrollPeriod | None:
        stmt = select(PayPayrollPeriod).where(PayPayrollPeriod.id == row_id, PayPayrollPeriod.is_deleted.is_(False))
        stmt = self.apply_pay_filter(stmt, PayPayrollPeriod, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(PayPayrollPeriod).where(
            PayPayrollPeriod.company_id == company_id,
            PayPayrollPeriod.is_deleted.is_(False),
        )
        stmt = self.apply_pay_filter(stmt, PayPayrollPeriod, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt.order_by(PayPayrollPeriod.start_date.desc())).all())

    def get_by_period_code(self, ctx: TenantContext, company_id: UUID, period_code: str) -> PayPayrollPeriod | None:
        stmt = select(PayPayrollPeriod).where(
            PayPayrollPeriod.company_id == company_id,
            PayPayrollPeriod.period_code == period_code,
            PayPayrollPeriod.is_deleted.is_(False),
        )
        stmt = self.apply_pay_filter(stmt, PayPayrollPeriod, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> PayPayrollPeriod:
        row = PayPayrollPeriod(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PayPayrollPeriod | None:
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
