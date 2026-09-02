"""Asset AstAssetServiceHistory repository (FP-ASSET-013).

Text search joins ``ast_asset`` only when ``q`` is supplied. For large tenants,
consider a future PostgreSQL ``pg_trgm`` index on ``service_summary`` (no migration
in FP-ASSET-013 scope).
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.asset.models import AstAsset, AstAssetServiceHistory
from modules.asset.repository.base import AstScopedRepository
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class AssetServiceHistoryListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    maintenance_id: UUID | None = None
    branch_id: UUID | None = None
    serviced_from: datetime | None = None
    serviced_to: datetime | None = None
    search: str | None = None


class AssetServiceHistoryRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetServiceHistory | None:
        stmt = select(AstAssetServiceHistory).where(
            AstAssetServiceHistory.id == row_id,
            AstAssetServiceHistory.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetServiceHistory, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        """Unpaginated company listing for internal callers (e.g. ApplicationService.list)."""
        items, _ = self.search(
            ctx,
            AssetServiceHistoryListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetServiceHistoryListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetServiceHistory], int]:
        stmt = select(AstAssetServiceHistory).where(
            AstAssetServiceHistory.company_id == filters.company_id,
            AstAssetServiceHistory.is_deleted.is_(False),
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetServiceHistory.asset_id == filters.asset_id)
        if filters.maintenance_id is not None:
            stmt = stmt.where(AstAssetServiceHistory.maintenance_id == filters.maintenance_id)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetServiceHistory.branch_id == filters.branch_id)
        if filters.serviced_from is not None:
            stmt = stmt.where(AstAssetServiceHistory.serviced_at >= filters.serviced_from)
        if filters.serviced_to is not None:
            stmt = stmt.where(AstAssetServiceHistory.serviced_at <= filters.serviced_to)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.outerjoin(AstAsset, AstAsset.id == AstAssetServiceHistory.asset_id).where(
                or_(
                    AstAssetServiceHistory.service_summary.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetServiceHistory, ctx, branch_scoped=False)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetServiceHistory.serviced_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstAssetServiceHistory:
        row = AstAssetServiceHistory(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row
