"""Payroll PaySalaryStructure repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.models import PaySalaryStructure
from modules.payroll.repository.base import PayScopedRepository, utcnow


class SalaryStructureRepository(PayScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> PaySalaryStructure | None:
        stmt = select(PaySalaryStructure).where(PaySalaryStructure.id == row_id, PaySalaryStructure.is_deleted.is_(False))
        stmt = self.apply_pay_filter(stmt, PaySalaryStructure, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(PaySalaryStructure).where(
            PaySalaryStructure.company_id == company_id,
            PaySalaryStructure.is_deleted.is_(False),
        )
        stmt = self.apply_pay_filter(stmt, PaySalaryStructure, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> PaySalaryStructure:
        row = PaySalaryStructure(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PaySalaryStructure | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    def soft_delete(self, ctx: TenantContext, row_id: UUID) -> bool:
        row = self.get(ctx, row_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return True
