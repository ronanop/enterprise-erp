"""Quality sampling plan repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmSamplingPlan
from modules.quality.repository.base import QmScopedRepository, utcnow


class SamplingPlanRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, plan_id: UUID) -> QmSamplingPlan | None:
        stmt = select(QmSamplingPlan).where(
            QmSamplingPlan.id == plan_id, QmSamplingPlan.is_deleted.is_(False)
        )
        stmt = self.apply_qm_filter(stmt, QmSamplingPlan, ctx)
        return self.db.scalar(stmt)

    def list_plans(self, ctx: TenantContext, company_id: UUID):
        stmt = select(QmSamplingPlan).where(
            QmSamplingPlan.company_id == company_id,
            QmSamplingPlan.is_deleted.is_(False),
        )
        stmt = self.apply_qm_filter(stmt, QmSamplingPlan, ctx)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmSamplingPlan:
        row = QmSamplingPlan(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, plan_id: UUID, **fields) -> QmSamplingPlan | None:
        row = self.get(ctx, plan_id)
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
