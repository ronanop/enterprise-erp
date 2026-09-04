"""Asset AstAssetLocation repository (FP-ASSET-012)."""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.domain.enums import AssetLocationStatus
from modules.asset.models import AstAsset, AstAssetLocation
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

ACTIVE_STATUS = AssetLocationStatus.ACTIVE.value


@dataclass(frozen=True)
class AssetLocationListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    status: str | None = None
    is_current: bool | None = None
    branch_id: UUID | None = None
    search: str | None = None


class AssetLocationRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetLocation | None:
        stmt = select(AstAssetLocation).where(
            AstAssetLocation.id == row_id,
            AstAssetLocation.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetLocation, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetLocationListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def find_current(self, ctx: TenantContext, asset_id: UUID) -> list[AstAssetLocation]:
        stmt = select(AstAssetLocation).where(
            AstAssetLocation.asset_id == asset_id,
            AstAssetLocation.is_current.is_(True),
            AstAssetLocation.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetLocation, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def find_current_for_asset(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        asset_id: UUID,
        exclude_id: UUID | None = None,
    ) -> AstAssetLocation | None:
        stmt = select(AstAssetLocation).where(
            AstAssetLocation.company_id == company_id,
            AstAssetLocation.asset_id == asset_id,
            AstAssetLocation.is_current.is_(True),
            AstAssetLocation.is_deleted.is_(False),
            AstAssetLocation.status == ACTIVE_STATUS,
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetLocation.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetLocation, ctx, branch_scoped=False)
        return self.db.scalars(stmt.limit(1)).first()

    def search(
        self,
        ctx: TenantContext,
        filters: AssetLocationListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetLocation], int]:
        stmt = (
            select(AstAssetLocation)
            .outerjoin(AstAsset, AstAsset.id == AstAssetLocation.asset_id)
            .where(
                AstAssetLocation.company_id == filters.company_id,
                AstAssetLocation.is_deleted.is_(False),
            )
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetLocation.asset_id == filters.asset_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetLocation.status == filters.status)
        if filters.is_current is not None:
            stmt = stmt.where(AstAssetLocation.is_current.is_(filters.is_current))
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetLocation.branch_id == filters.branch_id)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetLocation.location_label.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetLocation, ctx, branch_scoped=False)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetLocation.created_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstAssetLocation:
        row = AstAssetLocation(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetLocation | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Asset location has been modified by another user; reload and retry"
            )
        for k, v in fields.items():
            if v is not None or k in {
                "branch_id",
                "org_location_id",
                "effective_from",
                "effective_to",
                "location_label",
                "status",
                "is_current",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
