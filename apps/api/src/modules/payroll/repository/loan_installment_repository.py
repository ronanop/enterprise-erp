"""Payroll PayLoanInstallment repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.models import PayLoanInstallment
from modules.payroll.repository.base import PayScopedRepository, utcnow


class LoanInstallmentRepository(PayScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayLoanInstallment | None:
        stmt = select(PayLoanInstallment).where(PayLoanInstallment.id == row_id, PayLoanInstallment.is_deleted.is_(False))
        stmt = self.apply_pay_filter(stmt, PayLoanInstallment, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(PayLoanInstallment).where(PayLoanInstallment.is_deleted.is_(False))
        if company_id is not None:
            stmt = stmt.where(PayLoanInstallment.company_id == company_id)
        stmt = self.apply_pay_filter(stmt, PayLoanInstallment, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> PayLoanInstallment:
        row = PayLoanInstallment(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PayLoanInstallment | None:
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
