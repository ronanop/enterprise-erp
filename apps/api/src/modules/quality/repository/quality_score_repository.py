"""Quality KPI score repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmQualityScore
from modules.quality.repository.base import QmScopedRepository, utcnow


class QualityScoreRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, score_id: UUID) -> QmQualityScore | None:
        stmt = select(QmQualityScore).where(
            QmQualityScore.id == score_id,
            QmQualityScore.is_deleted.is_(False),
        )
        stmt = self.apply_qm_filter(stmt, QmQualityScore, ctx)
        return self.db.scalar(stmt)

    def list_scores(self, ctx: TenantContext, company_id: UUID, dimension: str | None = None):
        stmt = select(QmQualityScore).where(
            QmQualityScore.company_id == company_id,
            QmQualityScore.is_deleted.is_(False),
        )
        if dimension is not None:
            stmt = stmt.where(QmQualityScore.score_dimension == dimension)
        stmt = self.apply_qm_filter(stmt, QmQualityScore, ctx)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmQualityScore:
        row = QmQualityScore(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, score_id: UUID, **fields) -> QmQualityScore | None:
        row = self.get(ctx, score_id)
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
