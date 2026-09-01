"""HR HrTrainingRequest repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models import HrTrainingRequest
from modules.hr.repository.base import HrScopedRepository, utcnow


class TrainingRequestRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrTrainingRequest | None:
        stmt = select(HrTrainingRequest).where(
            HrTrainingRequest.id == row_id, HrTrainingRequest.is_deleted.is_(False)
        )
        stmt = self.apply_hr_filter(stmt, HrTrainingRequest, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(HrTrainingRequest).where(HrTrainingRequest.is_deleted.is_(False))
        if company_id is not None:
            stmt = stmt.where(HrTrainingRequest.company_id == company_id)
        stmt = self.apply_hr_filter(stmt, HrTrainingRequest, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrTrainingRequest:
        now = utcnow()
        row = HrTrainingRequest(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_at=now,
            updated_at=now,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrTrainingRequest | None:
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
