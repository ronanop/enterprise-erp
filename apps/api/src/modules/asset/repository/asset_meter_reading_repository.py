"""Asset meter reading repository (FP-ASSET-015).

Text search joins ``ast_asset`` only when ``q`` is supplied. For large tenants,
consider a future PostgreSQL ``pg_trgm`` index on asset code/name.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.domain.enums import AssetMeterReadingStatus
from modules.asset.models import AstAsset, AstAssetMeterReading
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class AssetMeterReadingListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    meter_type: str | None = None
    branch_id: UUID | None = None
    status: str | None = None
    reading_from: datetime | None = None
    reading_to: datetime | None = None
    search: str | None = None


class AssetMeterReadingRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self._assets = AssetRepository(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetMeterReading | None:
        stmt = select(AstAssetMeterReading).where(
            AstAssetMeterReading.id == row_id,
            AstAssetMeterReading.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetMeterReading, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        """Unpaginated company listing for internal callers (e.g. ApplicationService.list)."""
        items, _ = self.search(
            ctx,
            AssetMeterReadingListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def find_latest_reading(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        meter_type: str,
        *,
        for_update: bool = False,
    ) -> AstAssetMeterReading | None:
        stmt = (
            select(AstAssetMeterReading)
            .where(
                AstAssetMeterReading.asset_id == asset_id,
                AstAssetMeterReading.meter_type == meter_type,
                AstAssetMeterReading.status == AssetMeterReadingStatus.RECORDED.value,
                AstAssetMeterReading.is_deleted.is_(False),
            )
            .order_by(
                AstAssetMeterReading.reading_at.desc(),
                AstAssetMeterReading.created_at.desc(),
            )
            .limit(1)
        )
        stmt = self.apply_ast_filter(stmt, AstAssetMeterReading, ctx, branch_scoped=False)
        if for_update:
            stmt = stmt.with_for_update()
        return self.db.scalars(stmt).first()

    def find_duplicate_reading(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        meter_type: str,
        reading_at: datetime,
        reading_value: Decimal,
    ) -> AstAssetMeterReading | None:
        stmt = select(AstAssetMeterReading).where(
            AstAssetMeterReading.asset_id == asset_id,
            AstAssetMeterReading.meter_type == meter_type,
            AstAssetMeterReading.reading_at == reading_at,
            AstAssetMeterReading.reading_value == reading_value,
            AstAssetMeterReading.status == AssetMeterReadingStatus.RECORDED.value,
            AstAssetMeterReading.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetMeterReading, ctx, branch_scoped=False)
        return self.db.scalars(stmt.limit(1)).first()

    def lock_create_scope(self, ctx: TenantContext, asset_id: UUID, meter_type: str) -> None:
        """Serialize concurrent creates for the same asset and meter type.

        Locks the latest non-void reading when present; otherwise locks the parent asset row.
        """
        latest = self.find_latest_reading(ctx, asset_id, meter_type, for_update=True)
        if latest is None:
            locked = self._assets.lock_for_update(ctx, asset_id)
            if locked is None:
                return
            # Re-check after asset lock in case a peer inserted while waiting.
            self.find_latest_reading(ctx, asset_id, meter_type, for_update=True)

    def search(
        self,
        ctx: TenantContext,
        filters: AssetMeterReadingListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetMeterReading], int]:
        stmt = select(AstAssetMeterReading).where(
            AstAssetMeterReading.company_id == filters.company_id,
            AstAssetMeterReading.is_deleted.is_(False),
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetMeterReading.asset_id == filters.asset_id)
        if filters.meter_type is not None:
            stmt = stmt.where(AstAssetMeterReading.meter_type == filters.meter_type)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetMeterReading.branch_id == filters.branch_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetMeterReading.status == filters.status)
        if filters.reading_from is not None:
            stmt = stmt.where(AstAssetMeterReading.reading_at >= filters.reading_from)
        if filters.reading_to is not None:
            stmt = stmt.where(AstAssetMeterReading.reading_at <= filters.reading_to)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.outerjoin(AstAsset, AstAsset.id == AstAssetMeterReading.asset_id).where(
                or_(
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                    AstAssetMeterReading.meter_type.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetMeterReading, ctx, branch_scoped=False)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetMeterReading.reading_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstAssetMeterReading:
        row = AstAssetMeterReading(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetMeterReading | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Asset meter reading has been modified by another user; reload and retry"
            )
        for key, value in fields.items():
            if value is not None:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
