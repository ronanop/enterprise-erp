"""LocationService — asset location management (FP-ASSET-012)."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetLocationStatus
from modules.asset.models import AstAssetLocation
from modules.asset.repository.asset_location_repository import (
    AssetLocationListFilters,
    AssetLocationRepository,
)
from modules.asset.repository.base import utcnow
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.engines import AssetLocationEngine
from modules.asset.service.location_validator import LocationValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_ASSET_LOCATION = "ast_asset_location"


class LocationService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetLocationRepository(db)
        self._scope = AssetScopeValidator(db)
        self._engine = AssetLocationEngine()
        self._audit = AuditService(db)
        self._validator = LocationValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        status: str | None = None,
        is_current: bool | None = None,
        branch_id: UUID | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetLocation], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetLocationListFilters(
            company_id=cid,
            asset_id=asset_id,
            status=status,
            is_current=is_current,
            branch_id=branch_id,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetLocation:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset location not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        effective_from = fields.get("effective_from") or utcnow()
        self._supersede_current_locations(ctx, fields["asset_id"], effective_from)

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=fields.get("branch_id"),
            asset_id=fields["asset_id"],
            location_label=fields["location_label"].strip(),
            org_location_id=fields.get("org_location_id"),
            effective_from=effective_from,
            is_current=True,
            status=AssetLocationStatus.ACTIVE.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET_LOCATION,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "asset_id": str(row.asset_id),
                "location_label": row.location_label,
            },
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        self._validator.validate_update_fields(ctx, row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Asset location not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET_LOCATION,
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
            raise NotFoundException("Asset location not found")
        effective_to = utcnow()
        self._engine.complete(claimed, effective_to=effective_to)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            is_current=claimed.is_current,
            effective_to=claimed.effective_to,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET_LOCATION,
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
        )
        return updated

    def _supersede_current_locations(self, ctx: TenantContext, asset_id: UUID, effective_to) -> None:
        for current in self._repo.find_current(ctx, asset_id):
            self._engine.mark_historical(current)
            current.effective_to = effective_to
