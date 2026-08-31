"""Asset AstAssetDisposal repository (FP-ASSET-005)."""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.domain.enums import AssetDisposalStatus
from modules.asset.models import AstAsset, AstAssetDisposal
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

OPEN_DISPOSAL_STATUSES = (
    AssetDisposalStatus.DRAFT.value,
    AssetDisposalStatus.SUBMITTED.value,
    AssetDisposalStatus.APPROVED.value,
)


@dataclass(frozen=True)
class AssetDisposalListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    branch_id: UUID | None = None
    status: str | None = None
    disposal_type: str | None = None
    search: str | None = None


class AssetDisposalRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetDisposal | None:
        stmt = select(AstAssetDisposal).where(
            AstAssetDisposal.id == row_id,
            AstAssetDisposal.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetDisposal, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetDisposalListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetDisposalListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetDisposal], int]:
        stmt = (
            select(AstAssetDisposal)
            .join(AstAsset, AstAsset.id == AstAssetDisposal.asset_id)
            .where(
                AstAssetDisposal.company_id == filters.company_id,
                AstAssetDisposal.is_deleted.is_(False),
                AstAsset.is_deleted.is_(False),
            )
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetDisposal.asset_id == filters.asset_id)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetDisposal.branch_id == filters.branch_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetDisposal.status == filters.status)
        if filters.disposal_type is not None:
            stmt = stmt.where(AstAssetDisposal.disposal_type == filters.disposal_type)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetDisposal.document_number.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetDisposal, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetDisposal.created_at.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def find_pending_for_asset(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        exclude_id: UUID | None = None,
    ) -> AstAssetDisposal | None:
        stmt = select(AstAssetDisposal).where(
            AstAssetDisposal.asset_id == asset_id,
            AstAssetDisposal.status.in_(OPEN_DISPOSAL_STATUSES),
            AstAssetDisposal.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetDisposal.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetDisposal, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> AstAssetDisposal:
        row = AstAssetDisposal(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetDisposal | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Disposal has been modified by another user; reload and retry"
            )
        for k, v in fields.items():
            if v is not None or k in {
                "workflow_status",
                "workflow_instance_id",
                "disposal_date",
                "proceeds_amount",
                "book_value_at_disposal",
                "finance_journal_id",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
