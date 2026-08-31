"""Asset AstAssetDepreciation repository (FP-ASSET-006)."""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.domain.enums import AssetDepreciationStatus
from modules.asset.models import AstAsset, AstAssetDepreciation
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

NON_REVERSED_STATUSES = (
    AssetDepreciationStatus.DRAFT.value,
    AssetDepreciationStatus.CALCULATED.value,
    AssetDepreciationStatus.POSTED.value,
    AssetDepreciationStatus.FAILED.value,
)


@dataclass(frozen=True)
class AssetDepreciationListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    status: str | None = None
    method: str | None = None
    period_year: int | None = None
    period_month: int | None = None
    depreciation_batch_id: UUID | None = None
    search: str | None = None


class AssetDepreciationRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetDepreciation | None:
        stmt = select(AstAssetDepreciation).where(
            AstAssetDepreciation.id == row_id,
            AstAssetDepreciation.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetDepreciation, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetDepreciationListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetDepreciationListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetDepreciation], int]:
        stmt = (
            select(AstAssetDepreciation)
            .join(AstAsset, AstAsset.id == AstAssetDepreciation.asset_id)
            .where(
                AstAssetDepreciation.company_id == filters.company_id,
                AstAssetDepreciation.is_deleted.is_(False),
                AstAsset.is_deleted.is_(False),
            )
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetDepreciation.asset_id == filters.asset_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetDepreciation.status == filters.status)
        if filters.method is not None:
            stmt = stmt.where(AstAssetDepreciation.method == filters.method)
        if filters.period_year is not None:
            stmt = stmt.where(AstAssetDepreciation.period_year == filters.period_year)
        if filters.period_month is not None:
            stmt = stmt.where(AstAssetDepreciation.period_month == filters.period_month)
        if filters.depreciation_batch_id is not None:
            stmt = stmt.where(
                AstAssetDepreciation.depreciation_batch_id == filters.depreciation_batch_id
            )
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetDepreciation.document_number.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetDepreciation, ctx, branch_scoped=False)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(
                    AstAssetDepreciation.period_year.desc(),
                    AstAssetDepreciation.period_month.desc(),
                    AstAssetDepreciation.created_at.desc(),
                )
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def find_for_asset_period(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        period_year: int,
        period_month: int,
        *,
        exclude_id: UUID | None = None,
        exclude_reversed: bool = True,
    ) -> AstAssetDepreciation | None:
        stmt = select(AstAssetDepreciation).where(
            AstAssetDepreciation.asset_id == asset_id,
            AstAssetDepreciation.period_year == period_year,
            AstAssetDepreciation.period_month == period_month,
            AstAssetDepreciation.is_deleted.is_(False),
        )
        if exclude_reversed:
            stmt = stmt.where(AstAssetDepreciation.status.in_(NON_REVERSED_STATUSES))
        if exclude_id is not None:
            stmt = stmt.where(AstAssetDepreciation.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetDepreciation, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def find_by_batch(
        self,
        ctx: TenantContext,
        depreciation_batch_id: UUID,
    ) -> list[AstAssetDepreciation]:
        stmt = select(AstAssetDepreciation).where(
            AstAssetDepreciation.depreciation_batch_id == depreciation_batch_id,
            AstAssetDepreciation.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetDepreciation, ctx, branch_scoped=False)
        return list(
            self.db.scalars(stmt.order_by(AstAssetDepreciation.document_number.asc())).all()
        )

    def create(self, ctx: TenantContext, **fields) -> AstAssetDepreciation:
        row = AstAssetDepreciation(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetDepreciation | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Depreciation has been modified by another user; reload and retry"
            )
        for k, v in fields.items():
            if v is not None or k in {
                "depreciation_amount",
                "book_value_after",
                "units_produced",
                "finance_journal_id",
                "depreciation_batch_id",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
