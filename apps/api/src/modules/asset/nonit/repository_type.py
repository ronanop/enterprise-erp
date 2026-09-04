"""Non-IT asset type repository."""

from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from modules.asset.models import AstNonitAssetType
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class NonItAssetTypeRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstNonitAssetType | None:
        stmt = select(AstNonitAssetType).where(
            AstNonitAssetType.id == row_id,
            AstNonitAssetType.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstNonitAssetType, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def get_by_name(
        self, ctx: TenantContext, company_id: UUID, name: str
    ) -> AstNonitAssetType | None:
        stmt = select(AstNonitAssetType).where(
            AstNonitAssetType.company_id == company_id,
            AstNonitAssetType.name.ilike(name.strip()),
            AstNonitAssetType.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstNonitAssetType, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def get_by_prefix(
        self, ctx: TenantContext, company_id: UUID, prefix: str
    ) -> AstNonitAssetType | None:
        stmt = select(AstNonitAssetType).where(
            AstNonitAssetType.company_id == company_id,
            AstNonitAssetType.prefix == prefix,
            AstNonitAssetType.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstNonitAssetType, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        active: bool | None = None,
        search: str | None = None,
        category: str | None = None,
    ) -> list[AstNonitAssetType]:
        stmt = select(AstNonitAssetType).where(
            AstNonitAssetType.company_id == company_id,
            AstNonitAssetType.is_deleted.is_(False),
        )
        if active is not None:
            stmt = stmt.where(AstNonitAssetType.active.is_(active))
        if category:
            stmt = stmt.where(AstNonitAssetType.category == category)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstNonitAssetType.name.ilike(term),
                    AstNonitAssetType.prefix.ilike(term),
                    AstNonitAssetType.description.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstNonitAssetType, ctx, branch_scoped=False)
        return list(
            self.db.scalars(
                stmt.order_by(AstNonitAssetType.category.asc(), AstNonitAssetType.name.asc())
            ).all()
        )

    def create(self, ctx: TenantContext, **fields) -> AstNonitAssetType:
        meta = fields.pop("metadata", None)
        if "metadata_json" not in fields:
            fields["metadata_json"] = meta
        row = AstNonitAssetType(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstNonitAssetType | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        if "metadata" in fields:
            fields["metadata_json"] = fields.pop("metadata")
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

    def lock_for_update(self, ctx: TenantContext, row_id: UUID) -> AstNonitAssetType | None:
        stmt = (
            select(AstNonitAssetType)
            .where(
                AstNonitAssetType.id == row_id,
                AstNonitAssetType.is_deleted.is_(False),
            )
            .with_for_update()
        )
        stmt = self.apply_ast_filter(stmt, AstNonitAssetType, ctx, branch_scoped=False)
        return self.db.scalar(stmt)
