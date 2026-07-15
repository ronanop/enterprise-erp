"""GRC GrcRiskAssessment repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.grc.models import GrcRiskAssessment
from modules.grc.repository.base import GrcScopedRepository, utcnow


class RiskAssessmentRepository(GrcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> GrcRiskAssessment | None:
        stmt = select(GrcRiskAssessment).where(GrcRiskAssessment.id == row_id, GrcRiskAssessment.is_deleted.is_(False))
        stmt = self.apply_grc_filter(stmt, GrcRiskAssessment, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(GrcRiskAssessment).where(
            GrcRiskAssessment.company_id == company_id,
            GrcRiskAssessment.is_deleted.is_(False),
        )
        stmt = self.apply_grc_filter(stmt, GrcRiskAssessment, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> GrcRiskAssessment:
        row = GrcRiskAssessment(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> GrcRiskAssessment | None:
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
