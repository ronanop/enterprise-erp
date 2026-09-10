"""Quality PPAP repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmPpap
from modules.quality.repository.base import QmScopedRepository, utcnow


class PpapRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, ppap_id: UUID) -> QmPpap | None:
        stmt = select(QmPpap).where(QmPpap.id == ppap_id, QmPpap.is_deleted.is_(False))
        stmt = self.apply_qm_filter(stmt, QmPpap, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_ppaps(self, ctx: TenantContext, company_id: UUID):
        stmt = select(QmPpap).where(
            QmPpap.company_id == company_id,
            QmPpap.is_deleted.is_(False),
        )
        stmt = self.apply_qm_filter(stmt, QmPpap, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmPpap:
        row = QmPpap(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, ppap_id: UUID, **fields) -> QmPpap | None:
        row = self.get(ctx, ppap_id)
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
