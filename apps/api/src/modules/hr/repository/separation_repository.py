"""HR HrSeparation repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models import HrSeparation
from modules.hr.repository.base import HrScopedRepository, utcnow


class SeparationRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrSeparation | None:
        stmt = select(HrSeparation).where(HrSeparation.id == row_id, HrSeparation.is_deleted.is_(False))
        stmt = self.apply_hr_filter(stmt, HrSeparation, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(HrSeparation).where(
            HrSeparation.company_id == company_id,
            HrSeparation.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrSeparation, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrSeparation:
        row = HrSeparation(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrSeparation | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
                if k == "clearance_json":
                    flag_modified(row, "clearance_json")
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
