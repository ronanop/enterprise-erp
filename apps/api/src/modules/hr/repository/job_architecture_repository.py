"""Job level / grade master repositories."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.grade import HrGrade
from modules.hr.models.job_level import HrJobLevel
from modules.hr.repository.base import HrScopedRepository, utcnow


class JobLevelRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrJobLevel | None:
        stmt = select(HrJobLevel).where(HrJobLevel.id == row_id, HrJobLevel.is_deleted.is_(False))
        stmt = self.apply_hr_filter(stmt, HrJobLevel, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(HrJobLevel).where(
            HrJobLevel.company_id == company_id,
            HrJobLevel.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrJobLevel, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrJobLevel:
        row = HrJobLevel(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrJobLevel | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row


class GradeRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrGrade | None:
        stmt = select(HrGrade).where(HrGrade.id == row_id, HrGrade.is_deleted.is_(False))
        stmt = self.apply_hr_filter(stmt, HrGrade, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(HrGrade).where(
            HrGrade.company_id == company_id,
            HrGrade.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrGrade, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrGrade:
        row = HrGrade(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrGrade | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
