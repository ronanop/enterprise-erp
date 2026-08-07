"""PayPayrollPolicy repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.models.payroll_policy import PayPayrollPolicy
from modules.payroll.repository.base import PayScopedRepository, utcnow


class PayrollPolicyRepository(PayScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayPayrollPolicy | None:
        stmt = select(PayPayrollPolicy).where(
            PayPayrollPolicy.id == row_id,
            PayPayrollPolicy.is_deleted.is_(False),
        )
        stmt = self.apply_pay_filter(stmt, PayPayrollPolicy, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID) -> list[PayPayrollPolicy]:
        stmt = select(PayPayrollPolicy).where(
            PayPayrollPolicy.company_id == company_id,
            PayPayrollPolicy.is_deleted.is_(False),
        )
        stmt = self.apply_pay_filter(stmt, PayPayrollPolicy, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def get_active(self, ctx: TenantContext, company_id: UUID) -> PayPayrollPolicy | None:
        stmt = (
            select(PayPayrollPolicy)
            .where(
                PayPayrollPolicy.company_id == company_id,
                PayPayrollPolicy.status == "active",
                PayPayrollPolicy.is_deleted.is_(False),
            )
            .order_by(PayPayrollPolicy.effective_from.desc())
            .limit(1)
        )
        stmt = self.apply_pay_filter(stmt, PayPayrollPolicy, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> PayPayrollPolicy:
        row = PayPayrollPolicy(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PayPayrollPolicy | None:
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

    def archive_other_active(self, ctx: TenantContext, company_id: UUID, keep_id: UUID) -> None:
        for row in self.list_rows(ctx, company_id):
            if row.id != keep_id and row.status == "active":
                row.status = "archived"
                row.updated_at = utcnow()
                row.updated_by = ctx.user_id
        self.db.flush()
