"""Quality recall repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmRecall
from modules.quality.repository.base import QmScopedRepository, utcnow


class RecallRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, recall_id: UUID) -> QmRecall | None:
        stmt = select(QmRecall).where(QmRecall.id == recall_id, QmRecall.is_deleted.is_(False))
        stmt = self.apply_qm_filter(stmt, QmRecall, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_recalls(self, ctx: TenantContext, company_id: UUID, product_id: UUID | None = None):
        stmt = select(QmRecall).where(
            QmRecall.company_id == company_id,
            QmRecall.is_deleted.is_(False),
        )
        if product_id is not None:
            stmt = stmt.where(QmRecall.product_id == product_id)
        stmt = self.apply_qm_filter(stmt, QmRecall, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmRecall:
        row = QmRecall(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, recall_id: UUID, **fields) -> QmRecall | None:
        row = self.get(ctx, recall_id)
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
