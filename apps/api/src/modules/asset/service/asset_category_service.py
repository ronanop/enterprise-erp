"""AssetCategoryService application service (CR-001)."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetCategoryStatus
from modules.asset.models import AstAssetCategory
from modules.asset.repository.asset_category_repository import AssetCategoryRepository
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.category_validator import CategoryValidator
from modules.asset.service.engines import AssetCategoryEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class AssetCategoryService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetCategoryRepository(db)
        self._scope = AssetScopeValidator(db)
        self._validator = CategoryValidator(db)
        self._engine = AssetCategoryEngine()
        self._audit = AuditService(db)

    def list(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        status: str | None = None,
        search: str | None = None,
        asset_domain: str | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        domain = (asset_domain or "").strip().upper() or "IT"
        return self._repo.list_rows(ctx, cid, status=status, search=search, asset_domain=domain)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetCategory:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset category not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        fields = dict(fields)
        fields.pop("status", None)
        self._validator.validate_create_fields(ctx, cid, fields)
        row = self._repo.create(
            ctx,
            company_id=cid,
            status=AssetCategoryStatus.ACTIVE.value,
            **fields,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_asset_category",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        fields = dict(fields)
        self._validator.validate_update_fields(row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Asset category not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_asset_category",
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def deactivate(self, ctx: TenantContext, row_id: UUID) -> AstAssetCategory:
        row = self.get(ctx, row_id)
        self._validator.validate_deactivate(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Asset category not found")
        self._engine.deactivate(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        if updated is None:
            raise NotFoundException("Asset category not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_asset_category",
            entity_id=row_id,
            operation="deactivate",
            performed_by=ctx.user_id,
        )
        return updated

    def reactivate(self, ctx: TenantContext, row_id: UUID) -> AstAssetCategory:
        row = self.get(ctx, row_id)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Asset category not found")
        self._engine.activate(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        if updated is None:
            raise NotFoundException("Asset category not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_asset_category",
            entity_id=row_id,
            operation="reactivate",
            performed_by=ctx.user_id,
        )
        return updated
