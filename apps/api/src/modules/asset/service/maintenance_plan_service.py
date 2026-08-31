"""MaintenancePlanService — asset maintenance plan management (FP-ASSET-011)."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetMaintenancePlanStatus, AstEntityType
from modules.asset.models import AstAssetMaintenancePlan
from modules.asset.repository.asset_maintenance_plan_repository import (
    AssetMaintenancePlanListFilters,
    AssetMaintenancePlanRepository,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetMaintenancePlanEngine
from modules.asset.service.maintenance_plan_validator import MaintenancePlanValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_MAINTENANCE_PLAN = "ast_asset_maintenance_plan"


class MaintenancePlanService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetMaintenancePlanRepository(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AssetMaintenancePlanEngine()
        self._audit = AuditService(db)
        self._validator = MaintenancePlanValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        maintenance_type: str | None = None,
        status: str | None = None,
        next_due_date: date | None = None,
        branch_id: UUID | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetMaintenancePlan], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetMaintenancePlanListFilters(
            company_id=cid,
            asset_id=asset_id,
            maintenance_type=maintenance_type,
            status=status,
            next_due_date=next_due_date,
            branch_id=branch_id,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetMaintenancePlan:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Maintenance plan not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        doc = self._numbers.generate(
            AstEntityType.MAINTENANCE_PLAN,
            cid,
            AstAssetMaintenancePlan,
            "document_number",
            ctx=ctx,
        )
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=fields.get("branch_id"),
            document_number=doc,
            asset_id=fields["asset_id"],
            plan_name=fields["plan_name"],
            maintenance_type=fields["maintenance_type"],
            frequency_days=fields.get("frequency_days"),
            frequency_meter_units=fields.get("frequency_meter_units"),
            next_due_date=fields.get("next_due_date"),
            status=AssetMaintenancePlanStatus.DRAFT.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE_PLAN,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "asset_id": str(row.asset_id),
                "document_number": row.document_number,
                "plan_name": row.plan_name,
            },
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        self._validator.validate_update_fields(ctx, row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Maintenance plan not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE_PLAN,
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
            raise NotFoundException("Maintenance plan not found")
        self._engine.activate(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE_PLAN,
            entity_id=row_id,
            operation="activate",
            performed_by=ctx.user_id,
        )
        return updated

    def pause(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_pause_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Maintenance plan not found")
        self._engine.pause(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE_PLAN,
            entity_id=row_id,
            operation="pause",
            performed_by=ctx.user_id,
        )
        return updated

    def resume(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_resume_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Maintenance plan not found")
        self._engine.resume(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE_PLAN,
            entity_id=row_id,
            operation="resume",
            performed_by=ctx.user_id,
        )
        return updated

    def close(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_close_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Maintenance plan not found")
        self._engine.close(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE_PLAN,
            entity_id=row_id,
            operation="close",
            performed_by=ctx.user_id,
        )
        return updated
