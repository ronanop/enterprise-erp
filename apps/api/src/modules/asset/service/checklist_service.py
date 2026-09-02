"""ChecklistService — asset checklist management (FP-ASSET-014)."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetChecklistStatus
from modules.asset.models import AstAssetChecklist
from modules.asset.repository.asset_checklist_repository import (
    AssetChecklistListFilters,
    AssetChecklistRepository,
)
from modules.asset.repository.base import utcnow
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.checklist_validator import ChecklistValidator
from modules.asset.service.engines import AssetChecklistEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_CHECKLIST = "ast_asset_checklist"


class ChecklistService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetChecklistRepository(db)
        self._scope = AssetScopeValidator(db)
        self._engine = AssetChecklistEngine()
        self._audit = AuditService(db)
        self._validator = ChecklistValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        maintenance_id: UUID | None = None,
        audit_id: UUID | None = None,
        branch_id: UUID | None = None,
        status: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetChecklist], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetChecklistListFilters(
            company_id=cid,
            asset_id=asset_id,
            maintenance_id=maintenance_id,
            audit_id=audit_id,
            branch_id=branch_id,
            status=status,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetChecklist:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Checklist not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        fields.pop("status", None)
        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=fields.get("branch_id"),
            asset_id=fields.get("asset_id"),
            maintenance_id=fields.get("maintenance_id"),
            audit_id=fields.get("audit_id"),
            checklist_code=str(fields["checklist_code"]).strip(),
            checklist_name=str(fields["checklist_name"]).strip(),
            items_json=fields.get("items_json"),
            status=AssetChecklistStatus.DRAFT.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_CHECKLIST,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "checklist_code": row.checklist_code,
                "asset_id": str(row.asset_id) if row.asset_id else None,
            },
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        self._validator.validate_update_fields(ctx, row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Checklist not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_CHECKLIST,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def complete(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_complete_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Checklist not found")
        when = utcnow()
        self._engine.complete(claimed, completed_at=when)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            completed_at=claimed.completed_at,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_CHECKLIST,
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
        )
        return updated

    def cancel(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_cancel_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Checklist not found")
        self._engine.cancel(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_CHECKLIST,
            entity_id=row_id,
            operation="cancel",
            performed_by=ctx.user_id,
        )
        return updated
