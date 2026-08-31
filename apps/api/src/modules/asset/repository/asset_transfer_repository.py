"""Asset transfer repository."""

from dataclasses import dataclass
from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.models import AstAsset, AstAssetTransfer
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class AssetTransferListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    branch_id: UUID | None = None
    status: str | None = None
    search: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None


class AssetTransferRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetTransfer | None:
        stmt = select(AstAssetTransfer).where(AstAssetTransfer.id == row_id, AstAssetTransfer.is_deleted.is_(False))
        stmt = self.apply_ast_filter(stmt, AstAssetTransfer, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetTransferListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetTransferListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetTransfer], int]:
        stmt = (
            select(AstAssetTransfer)
            .join(AstAsset, AstAsset.id == AstAssetTransfer.asset_id)
            .where(
                AstAssetTransfer.company_id == filters.company_id,
                AstAssetTransfer.is_deleted.is_(False),
                AstAsset.is_deleted.is_(False),
            )
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetTransfer.asset_id == filters.asset_id)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetTransfer.branch_id == filters.branch_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetTransfer.status == filters.status)
        if filters.effective_from is not None:
            stmt = stmt.where(AstAssetTransfer.effective_date >= filters.effective_from)
        if filters.effective_to is not None:
            stmt = stmt.where(AstAssetTransfer.effective_date <= filters.effective_to)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetTransfer.document_number.ilike(term),
                    AstAssetTransfer.reason.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetTransfer, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetTransfer.created_at.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def find_pending_for_asset(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        exclude_id: UUID | None = None,
    ) -> AstAssetTransfer | None:
        stmt = select(AstAssetTransfer).where(
            AstAssetTransfer.asset_id == asset_id,
            AstAssetTransfer.status.in_(["draft", "submitted", "approved"]),
            AstAssetTransfer.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetTransfer.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetTransfer, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> AstAssetTransfer:
        row = AstAssetTransfer(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetTransfer | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException("Transfer has been modified by another user; reload and retry")
        for k, v in fields.items():
            if v is not None or k in {"workflow_status", "workflow_instance_id"}:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
