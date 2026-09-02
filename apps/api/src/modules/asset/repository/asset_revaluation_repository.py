"""Asset AstAssetRevaluation repository (FP-ASSET-007)."""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.domain.enums import AssetRevaluationStatus
from modules.asset.models import AstAsset, AstAssetRevaluation
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

OPEN_REVALUATION_STATUSES = (
    AssetRevaluationStatus.DRAFT.value,
    AssetRevaluationStatus.SUBMITTED.value,
    AssetRevaluationStatus.APPROVED.value,
)


@dataclass(frozen=True)
class AssetRevaluationListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    branch_id: UUID | None = None
    status: str | None = None
    search: str | None = None


class AssetRevaluationRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetRevaluation | None:
        stmt = select(AstAssetRevaluation).where(
            AstAssetRevaluation.id == row_id,
            AstAssetRevaluation.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetRevaluation, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetRevaluationListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetRevaluationListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetRevaluation], int]:
        stmt = (
            select(AstAssetRevaluation)
            .join(AstAsset, AstAsset.id == AstAssetRevaluation.asset_id)
            .where(
                AstAssetRevaluation.company_id == filters.company_id,
                AstAssetRevaluation.is_deleted.is_(False),
                AstAsset.is_deleted.is_(False),
            )
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetRevaluation.asset_id == filters.asset_id)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetRevaluation.branch_id == filters.branch_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetRevaluation.status == filters.status)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetRevaluation.document_number.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetRevaluation, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetRevaluation.created_at.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def find_pending_for_asset(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        exclude_id: UUID | None = None,
    ) -> AstAssetRevaluation | None:
        stmt = select(AstAssetRevaluation).where(
            AstAssetRevaluation.asset_id == asset_id,
            AstAssetRevaluation.status.in_(OPEN_REVALUATION_STATUSES),
            AstAssetRevaluation.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetRevaluation.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetRevaluation, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> AstAssetRevaluation:
        row = AstAssetRevaluation(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetRevaluation | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Revaluation has been modified by another user; reload and retry"
            )
        for k, v in fields.items():
            if v is not None or k in {
                "workflow_status",
                "workflow_instance_id",
                "revaluation_date",
                "old_book_value",
                "new_book_value",
                "reason",
                "finance_journal_id",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
