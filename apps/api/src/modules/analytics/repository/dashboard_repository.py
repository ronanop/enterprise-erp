"""Analytics BiDashboard repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.analytics.models import BiDashboard
from modules.analytics.repository.base import AnalyticsScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class DashboardRepository(AnalyticsScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> BiDashboard | None:
        stmt = select(BiDashboard).where(BiDashboard.id == row_id, BiDashboard.is_deleted.is_(False))
        stmt = self.apply_analytics_filter(stmt, BiDashboard, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(BiDashboard).where(
            BiDashboard.company_id == company_id,
            BiDashboard.is_deleted.is_(False),
        )
        stmt = self.apply_analytics_filter(stmt, BiDashboard, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def code_exists(self, ctx: TenantContext, company_id: UUID, dashboard_code: str) -> bool:
        stmt = select(BiDashboard.id).where(
            BiDashboard.company_id == company_id,
            BiDashboard.dashboard_code == dashboard_code,
            BiDashboard.is_deleted.is_(False),
        )
        stmt = self.apply_analytics_filter(stmt, BiDashboard, ctx, branch_scoped=False)
        return self.db.scalar(stmt) is not None

    def create(self, ctx: TenantContext, **fields) -> BiDashboard:
        row = BiDashboard(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> BiDashboard | None:
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
