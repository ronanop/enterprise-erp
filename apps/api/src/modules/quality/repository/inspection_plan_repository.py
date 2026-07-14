"""Quality inspection plan repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmInspectionPlan
from modules.quality.repository.base import QmScopedRepository, utcnow


class InspectionPlanRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, plan_id: UUID) -> QmInspectionPlan | None:
        stmt = (
            select(QmInspectionPlan)
            .options(selectinload(QmInspectionPlan.characteristics))
            .where(QmInspectionPlan.id == plan_id, QmInspectionPlan.is_deleted.is_(False))
        )
        stmt = self.apply_qm_filter(stmt, QmInspectionPlan, ctx)
        return self.db.scalar(stmt)

    def list_plans(self, ctx: TenantContext, company_id: UUID, inspection_type: str | None = None):
        stmt = (
            select(QmInspectionPlan)
            .options(selectinload(QmInspectionPlan.characteristics))
            .where(
                QmInspectionPlan.company_id == company_id,
                QmInspectionPlan.is_deleted.is_(False),
            )
        )
        if inspection_type is not None:
            stmt = stmt.where(QmInspectionPlan.inspection_type == inspection_type)
        stmt = self.apply_qm_filter(stmt, QmInspectionPlan, ctx)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmInspectionPlan:
        row = QmInspectionPlan(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, plan_id: UUID, **fields) -> QmInspectionPlan | None:
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
