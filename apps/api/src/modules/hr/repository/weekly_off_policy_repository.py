"""HR weekly-off policy repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.weekly_off_policy import HrWeeklyOffPolicy
from modules.hr.repository.base import HrScopedRepository, utcnow


class WeeklyOffPolicyRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrWeeklyOffPolicy | None:
        stmt = select(HrWeeklyOffPolicy).where(
            HrWeeklyOffPolicy.id == row_id,
            HrWeeklyOffPolicy.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrWeeklyOffPolicy, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(HrWeeklyOffPolicy).where(HrWeeklyOffPolicy.is_deleted.is_(False))
        if company_id is not None:
            stmt = stmt.where(HrWeeklyOffPolicy.company_id == company_id)
        stmt = self.apply_hr_filter(stmt, HrWeeklyOffPolicy, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def get_default(self, ctx: TenantContext, company_id: UUID) -> HrWeeklyOffPolicy | None:
        rows = self.list_rows(ctx, company_id)
        active = [r for r in rows if r.status == "active"]
        for r in active:
            if r.is_default:
                return r
        return active[0] if active else None

    def create(self, ctx: TenantContext, **fields) -> HrWeeklyOffPolicy:
        row = HrWeeklyOffPolicy(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrWeeklyOffPolicy | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None or k in {"rules_json", "custom_weekdays_json", "alternate_saturday_start"}:
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
