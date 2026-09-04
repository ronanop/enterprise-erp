"""Asset AstAssetChecklist repository (FP-ASSET-014).

Text search joins ``ast_asset`` only when ``q`` is supplied. For large tenants,
consider a future PostgreSQL ``pg_trgm`` index on ``checklist_name``.
"""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.models import AstAsset, AstAssetChecklist
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class AssetChecklistListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    maintenance_id: UUID | None = None
    audit_id: UUID | None = None
    branch_id: UUID | None = None
    status: str | None = None
    search: str | None = None


class AssetChecklistRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetChecklist | None:
        stmt = select(AstAssetChecklist).where(
            AstAssetChecklist.id == row_id,
            AstAssetChecklist.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetChecklist, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        """Unpaginated company listing for internal callers (e.g. ApplicationService.list)."""
        items, _ = self.search(
            ctx,
            AssetChecklistListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def find_by_code(
        self,
        ctx: TenantContext,
        company_id: UUID,
        checklist_code: str,
        *,
        exclude_id: UUID | None = None,
    ) -> AstAssetChecklist | None:
        stmt = select(AstAssetChecklist).where(
            AstAssetChecklist.company_id == company_id,
            AstAssetChecklist.checklist_code == checklist_code,
            AstAssetChecklist.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetChecklist.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetChecklist, ctx, branch_scoped=False)
        return self.db.scalars(stmt.limit(1)).first()

    def search(
        self,
        ctx: TenantContext,
        filters: AssetChecklistListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetChecklist], int]:
        stmt = select(AstAssetChecklist).where(
            AstAssetChecklist.company_id == filters.company_id,
            AstAssetChecklist.is_deleted.is_(False),
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetChecklist.asset_id == filters.asset_id)
        if filters.maintenance_id is not None:
            stmt = stmt.where(AstAssetChecklist.maintenance_id == filters.maintenance_id)
        if filters.audit_id is not None:
            stmt = stmt.where(AstAssetChecklist.audit_id == filters.audit_id)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetChecklist.branch_id == filters.branch_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetChecklist.status == filters.status)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.outerjoin(AstAsset, AstAsset.id == AstAssetChecklist.asset_id).where(
                or_(
                    AstAssetChecklist.checklist_code.ilike(term),
                    AstAssetChecklist.checklist_name.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetChecklist, ctx, branch_scoped=False)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetChecklist.created_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstAssetChecklist:
        row = AstAssetChecklist(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetChecklist | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Asset checklist has been modified by another user; reload and retry"
            )
        for key, value in fields.items():
            if value is not None or key in {"items_json", "branch_id", "checklist_name"}:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
