"""Recruitment RecReferenceCheck repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.recruitment.models import RecReferenceCheck
from modules.recruitment.repository.base import RecScopedRepository, utcnow


class ReferenceCheckRepository(RecScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecReferenceCheck | None:
        stmt = select(RecReferenceCheck).where(RecReferenceCheck.id == row_id, RecReferenceCheck.is_deleted.is_(False))
        stmt = self.apply_rec_filter(stmt, RecReferenceCheck, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(RecReferenceCheck).where(RecReferenceCheck.is_deleted.is_(False))
        if company_id is not None:
            stmt = stmt.where(RecReferenceCheck.company_id == company_id)
        stmt = self.apply_rec_filter(stmt, RecReferenceCheck, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> RecReferenceCheck:
        row = RecReferenceCheck(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> RecReferenceCheck | None:
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
