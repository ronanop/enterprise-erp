"""WarrantyService — asset warranty management (FP-ASSET-009)."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetWarrantyStatus
from modules.asset.models import AstAssetWarranty
from modules.asset.repository.asset_warranty_repository import (
    AssetWarrantyListFilters,
    AssetWarrantyRepository,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.engines import AssetWarrantyEngine
from modules.asset.service.warranty_validator import WarrantyValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_WARRANTY = "ast_asset_warranty"


class WarrantyService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetWarrantyRepository(db)
        self._scope = AssetScopeValidator(db)
        self._engine = AssetWarrantyEngine()
        self._audit = AuditService(db)
        self._validator = WarrantyValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        vendor_id: UUID | None = None,
        warranty_type: str | None = None,
        status: str | None = None,
        end_date: date | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetWarranty], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetWarrantyListFilters(
            company_id=cid,
            asset_id=asset_id,
            vendor_id=vendor_id,
            warranty_type=warranty_type,
            status=status,
            end_date=end_date,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetWarranty:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Warranty not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=fields.get("branch_id"),
            asset_id=fields["asset_id"],
            vendor_id=fields.get("vendor_id"),
            warranty_type=fields["warranty_type"],
            start_date=fields["start_date"],
            end_date=fields["end_date"],
            coverage_notes=fields.get("coverage_notes"),
            status=AssetWarrantyStatus.DRAFT.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_WARRANTY,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "asset_id": str(row.asset_id),
                "warranty_type": row.warranty_type,
            },
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        self._validator.validate_update_fields(ctx, row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Warranty not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_WARRANTY,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def activate(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_activate_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Warranty not found")
        self._engine.activate(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_WARRANTY,
            entity_id=row_id,
            operation="activate",
            performed_by=ctx.user_id,
        )
        return updated

    def extend(self, ctx: TenantContext, row_id: UUID, *, new_end_date: date):
        row = self.get(ctx, row_id)
        self._validator.validate_extend_readiness(ctx, row, new_end_date=new_end_date)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Warranty not found")
        claimed.end_date = new_end_date
        self._engine.extend(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            end_date=claimed.end_date,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_WARRANTY,
            entity_id=row_id,
            operation="extend",
            performed_by=ctx.user_id,
            new_value={"end_date": str(new_end_date)},
        )
        return updated

    def expire(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_expire_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Warranty not found")
        self._engine.expire(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_WARRANTY,
            entity_id=row_id,
            operation="expire",
            performed_by=ctx.user_id,
        )
        return updated
