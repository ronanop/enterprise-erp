"""Asset document repository (FP-ASSET-016).

Text search joins ``ast_asset`` only when ``q`` is supplied. For large tenants,
consider a future PostgreSQL ``pg_trgm`` index on document_name / asset code.
"""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.models import AstAsset, AstAssetDocument
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class AssetDocumentListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    document_type: str | None = None
    branch_id: UUID | None = None
    status: str | None = None
    search: str | None = None


class AssetDocumentRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetDocument | None:
        stmt = select(AstAssetDocument).where(
            AstAssetDocument.id == row_id,
            AstAssetDocument.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetDocument, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        """Unpaginated company listing for internal callers (e.g. ApplicationService.list)."""
        items, _ = self.search(
            ctx,
            AssetDocumentListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetDocumentListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetDocument], int]:
        stmt = select(AstAssetDocument).where(
            AstAssetDocument.company_id == filters.company_id,
            AstAssetDocument.is_deleted.is_(False),
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetDocument.asset_id == filters.asset_id)
        if filters.document_type is not None:
            stmt = stmt.where(AstAssetDocument.document_type == filters.document_type)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetDocument.branch_id == filters.branch_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetDocument.status == filters.status)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.outerjoin(AstAsset, AstAsset.id == AstAssetDocument.asset_id).where(
                or_(
                    AstAssetDocument.document_name.ilike(term),
                    AstAssetDocument.document_type.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetDocument, ctx, branch_scoped=False)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetDocument.created_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstAssetDocument:
        row = AstAssetDocument(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetDocument | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Asset document has been modified by another user; reload and retry"
            )
        for key, value in fields.items():
            if value is not None or key in {
                "storage_uri",
                "content_hash",
                "branch_id",
                "document_name",
            }:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
