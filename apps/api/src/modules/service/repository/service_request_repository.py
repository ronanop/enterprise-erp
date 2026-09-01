"""Service SvcServiceRequest repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.service.models import SvcServiceRequest
from modules.service.repository.base import SvcScopedRepository, utcnow


class ServiceRequestRepository(SvcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> SvcServiceRequest | None:
        stmt = select(SvcServiceRequest).where(SvcServiceRequest.id == row_id, SvcServiceRequest.is_deleted.is_(False))
        stmt = self.apply_svc_filter(stmt, SvcServiceRequest, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(SvcServiceRequest).where(
            SvcServiceRequest.company_id == company_id,
            SvcServiceRequest.is_deleted.is_(False),
        )
        stmt = self.apply_svc_filter(stmt, SvcServiceRequest, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> SvcServiceRequest:
        row = SvcServiceRequest(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> SvcServiceRequest | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        # Allow explicit nulls so asset/date fields can be cleared from the UI
        for k, v in fields.items():
            if hasattr(row, k):
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
