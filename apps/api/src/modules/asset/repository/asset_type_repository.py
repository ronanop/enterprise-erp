"""IT Asset Type master repository."""

from uuid import UUID, uuid4

from sqlalchemy import true, func, or_, select
from sqlalchemy.orm import Session

from modules.asset.models import AstAsset, AstAssetType
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class AssetTypeRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetType | None:
        stmt = select(AstAssetType).where(
            AstAssetType.id == row_id,
            AstAssetType.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetType, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def get_by_name(
        self, ctx: TenantContext, company_id: UUID | None, name: str
    ) -> AstAssetType | None:
        stmt = select(AstAssetType).where(
            (AstAssetType.company_id == company_id if company_id is not None else true()),
            AstAssetType.name.ilike(name.strip()),
            AstAssetType.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetType, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(
        self,
        ctx: TenantContext,
        company_id: UUID | None,
        *,
        active: bool | None = None,
        search: str | None = None,
    ) -> list[AstAssetType]:
        stmt = select(AstAssetType).where(
            (AstAssetType.company_id == company_id if company_id is not None else true()),
            AstAssetType.is_deleted.is_(False),
        )
        if active is not None:
            stmt = stmt.where(AstAssetType.active.is_(active))
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetType.name.ilike(term),
                    AstAssetType.description.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetType, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt.order_by(AstAssetType.name.asc())).all())

    def create(self, ctx: TenantContext, **fields) -> AstAssetType:
        row = AstAssetType(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetType | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected = fields.pop("version", None)
        if expected is not None and int(row.version or 1) != int(expected):
            return None
        for key, value in fields.items():
            setattr(row, key, value)
        row.updated_by = ctx.user_id
        row.updated_at = utcnow()
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    def count_assets_by_type(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None,
        asset_type_id: UUID,
    ) -> int:
        stmt = select(func.count()).select_from(AstAsset).where(
            (AstAsset.company_id == company_id if company_id is not None else true()),
            AstAsset.asset_type_id == asset_type_id,
            AstAsset.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=False)
        return int(self.db.scalar(stmt) or 0)

    def soft_delete(self, ctx: TenantContext, row: AstAssetType) -> AstAssetType:
        """Soft-delete and free ``(company_id, name)`` so the label can be reused."""
        suffix = f"__del_{row.id.hex[:8]}"
        base = (row.name or "type").strip() or "type"
        max_base = max(1, 100 - len(suffix))
        row.name = f"{base[:max_base]}{suffix}"
        row.active = False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
