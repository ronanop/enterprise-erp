"""AssetAuditService — physical verification (FP-ASSET-008)."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetAuditStatus, AstEntityType
from modules.asset.domain.exceptions import AssetAuditValidationError
from modules.asset.models import AstAssetAudit
from modules.asset.repository.asset_audit_repository import (
    AssetAuditListFilters,
    AssetAuditRepository,
)
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.service.asset_audit_validator import AssetAuditValidator
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetAuditEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_AUDIT = "ast_asset_audit"


class AssetAuditService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetAuditRepository(db)
        self._assets = AssetRepository(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AssetAuditEngine()
        self._audit = AuditService(db)
        self._validator = AssetAuditValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        auditor_employee_id: UUID | None = None,
        status: str | None = None,
        found_status: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetAudit], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetAuditListFilters(
            company_id=cid,
            asset_id=asset_id,
            auditor_employee_id=auditor_employee_id,
            status=status,
            found_status=found_status,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetAudit:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset audit not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        asset = self._assets.get(ctx, fields["asset_id"])
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.branch_id != branch_id:
            raise AssetAuditValidationError(
                "Audit branch must match the asset's current branch"
            )

        doc = self._numbers.generate(
            AstEntityType.AUDIT,
            cid,
            AstAssetAudit,
            "document_number",
            ctx=ctx,
        )
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            asset_id=asset.id,
            auditor_employee_id=fields["auditor_employee_id"],
            audit_date=fields.get("audit_date"),
            found_status=fields.get("found_status"),
            notes=fields.get("notes"),
            status=AssetAuditStatus.PLANNED.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_AUDIT,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "document_number": row.document_number,
                "asset_id": str(asset.id),
            },
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        self._validator.validate_update_fields(ctx, row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Asset audit not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_AUDIT,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def start(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_start_readiness(ctx, row)
        self._engine.start(row)
        updated = self._repo.update(ctx, row_id, status=row.status, version=int(row.version or 1))
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_AUDIT,
            entity_id=row_id,
            operation="start",
            performed_by=ctx.user_id,
        )
        return updated

    def complete(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_complete_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Asset audit not found")
        self._engine.complete(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_AUDIT,
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
            new_value={"found_status": claimed.found_status},
        )
        return updated

    def cancel(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_cancel_readiness(ctx, row)
        self._engine.cancel(row)
        updated = self._repo.update(ctx, row_id, status=row.status, version=int(row.version or 1))
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_AUDIT,
            entity_id=row_id,
            operation="cancel",
            performed_by=ctx.user_id,
        )
        return updated
