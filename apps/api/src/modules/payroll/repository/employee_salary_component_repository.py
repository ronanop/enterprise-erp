"""Payroll PayEmployeeSalaryComponent repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.models import PayEmployeeSalaryComponent
from modules.payroll.repository.base import PayScopedRepository, utcnow


class EmployeeSalaryComponentRepository(PayScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayEmployeeSalaryComponent | None:
        stmt = select(PayEmployeeSalaryComponent).where(PayEmployeeSalaryComponent.id == row_id, PayEmployeeSalaryComponent.is_deleted.is_(False))
        stmt = self.apply_pay_filter(stmt, PayEmployeeSalaryComponent, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(PayEmployeeSalaryComponent).where(
            PayEmployeeSalaryComponent.company_id == company_id,
            PayEmployeeSalaryComponent.is_deleted.is_(False),
        )
        stmt = self.apply_pay_filter(stmt, PayEmployeeSalaryComponent, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> PayEmployeeSalaryComponent:
        row = PayEmployeeSalaryComponent(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PayEmployeeSalaryComponent | None:
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

    def list_for_salary(self, ctx: TenantContext, employee_salary_id: UUID):
        stmt = select(PayEmployeeSalaryComponent).where(
            PayEmployeeSalaryComponent.employee_salary_id == employee_salary_id,
            PayEmployeeSalaryComponent.is_deleted.is_(False),
        )
        stmt = self.apply_pay_filter(stmt, PayEmployeeSalaryComponent, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

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
