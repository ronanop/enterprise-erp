"""HR management group repository."""

from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.employment import HrEmployment
from modules.hr.models.management_group import HrManagementGroup
from modules.hr.repository.base import HrScopedRepository, utcnow


class ManagementGroupRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrManagementGroup | None:
        stmt = select(HrManagementGroup).where(
            HrManagementGroup.id == row_id,
            HrManagementGroup.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrManagementGroup, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID) -> list[HrManagementGroup]:
        stmt = select(HrManagementGroup).where(
            HrManagementGroup.company_id == company_id,
            HrManagementGroup.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrManagementGroup, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt.order_by(HrManagementGroup.group_name)).all())

    def count_for_company(self, ctx: TenantContext, company_id: UUID) -> int:
        stmt = select(func.count()).select_from(HrManagementGroup).where(
            HrManagementGroup.company_id == company_id,
            HrManagementGroup.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrManagementGroup, ctx, branch_scoped=False)
        return int(self.db.scalar(stmt) or 0)

    def count_employees(self, ctx: TenantContext, company_id: UUID, group_id: UUID) -> int:
        stmt = select(func.count()).select_from(HrEmployment).where(
            HrEmployment.company_id == company_id,
            HrEmployment.management_group_id == group_id,
            HrEmployment.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrEmployment, ctx, branch_scoped=False)
        return int(self.db.scalar(stmt) or 0)

    def create(self, ctx: TenantContext, **fields) -> HrManagementGroup:
        row = HrManagementGroup(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrManagementGroup | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None or k in {"description", "feature_toggles_json", "default_shift_rotation_id"}:
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
