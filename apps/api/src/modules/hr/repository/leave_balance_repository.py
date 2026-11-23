"""HR HrLeaveBalance repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models import HrLeaveBalance
from modules.hr.repository.base import HrScopedRepository, utcnow


class LeaveBalanceRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrLeaveBalance | None:
        stmt = select(HrLeaveBalance).where(HrLeaveBalance.id == row_id, HrLeaveBalance.is_deleted.is_(False))
        stmt = self.apply_hr_filter(stmt, HrLeaveBalance, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(HrLeaveBalance).where(HrLeaveBalance.is_deleted.is_(False))
        if company_id is not None:
            stmt = stmt.where(HrLeaveBalance.company_id == company_id)
        # Company-scoped (not branch): balances are entitlements; branch filter hid rows
        # and made Assign look empty while uk_hr_lbal_emp_type_year still blocked create.
        stmt = self.apply_hr_filter(stmt, HrLeaveBalance, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def find_by_natural_key(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        employee_id: UUID,
        leave_type_id: UUID,
        balance_year: int,
        include_deleted: bool = True,
    ) -> HrLeaveBalance | None:
        """Lookup for upsert — includes soft-deleted rows that still hold the unique key."""
        stmt = select(HrLeaveBalance).where(
            HrLeaveBalance.tenant_id == ctx.tenant_id,
            HrLeaveBalance.company_id == company_id,
            HrLeaveBalance.employee_id == employee_id,
            HrLeaveBalance.leave_type_id == leave_type_id,
            HrLeaveBalance.balance_year == balance_year,
        )
        if not include_deleted:
            stmt = stmt.where(HrLeaveBalance.is_deleted.is_(False))
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> HrLeaveBalance:
        row = HrLeaveBalance(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrLeaveBalance | None:
        row = self.get(ctx, row_id)
        if row is None:
            # Allow revive/update of soft-deleted unique-key hits
            row = self.db.get(HrLeaveBalance, row_id)
            if row is None or row.tenant_id != ctx.tenant_id:
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

    def revive_and_update(self, ctx: TenantContext, row: HrLeaveBalance, **fields) -> HrLeaveBalance:
        row.is_deleted = False
        row.deleted_at = None
        row.deleted_by = None
        for k, v in fields.items():
            if v is not None:
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
