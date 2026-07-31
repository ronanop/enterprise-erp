"""Asset AstAssetCategory repository."""

from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from modules.asset.models import AstAssetCategory
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class AssetCategoryRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetCategory | None:
        stmt = select(AstAssetCategory).where(
            AstAssetCategory.id == row_id,
            AstAssetCategory.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetCategory, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def get_by_code(
        self,
        ctx: TenantContext,
        company_id: UUID,
        category_code: str,
    ) -> AstAssetCategory | None:
        stmt = select(AstAssetCategory).where(
            AstAssetCategory.company_id == company_id,
            AstAssetCategory.category_code == category_code,
            AstAssetCategory.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetCategory, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        status: str | None = None,
        search: str | None = None,
    ):
        stmt = select(AstAssetCategory).where(
            AstAssetCategory.company_id == company_id,
            AstAssetCategory.is_deleted.is_(False),
        )
        if status:
            stmt = stmt.where(AstAssetCategory.status == status)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetCategory.category_code.ilike(term),
                    AstAssetCategory.category_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetCategory, ctx, branch_scoped=False)
        return list(
            self.db.scalars(stmt.order_by(AstAssetCategory.category_code.asc())).all()
        )

    def create(self, ctx: TenantContext, **fields) -> AstAssetCategory:
        row = AstAssetCategory(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetCategory | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            from core.exceptions import ConflictException

            raise ConflictException("Category version conflict; refresh and retry")
        for k, v in fields.items():
            if v is not None or k in {
                "default_useful_life_months",
                "default_depreciation_method",
                "gl_asset_account_id",
                "gl_accum_depr_account_id",
                "gl_expense_account_id",
                "branch_id",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
