"""ServiceHistoryService — asset service history management (FP-ASSET-013)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetServiceHistoryStatus
from modules.asset.models import AstAssetServiceHistory
from modules.asset.repository.asset_service_history_repository import (
    AssetServiceHistoryListFilters,
    AssetServiceHistoryRepository,
)
from modules.asset.repository.base import utcnow
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.engines import AssetServiceHistoryEngine
from modules.asset.service.service_history_validator import ServiceHistoryValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_SERVICE_HISTORY = "ast_asset_service_history"


class ServiceHistoryService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetServiceHistoryRepository(db)
        self._scope = AssetScopeValidator(db)
        self._engine = AssetServiceHistoryEngine()
        self._audit = AuditService(db)
        self._validator = ServiceHistoryValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        maintenance_id: UUID | None = None,
        branch_id: UUID | None = None,
        serviced_from: datetime | None = None,
        serviced_to: datetime | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetServiceHistory], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetServiceHistoryListFilters(
            company_id=cid,
            asset_id=asset_id,
            maintenance_id=maintenance_id,
            branch_id=branch_id,
            serviced_from=serviced_from,
            serviced_to=serviced_to,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetServiceHistory:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service history not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        serviced_at = fields.get("serviced_at") or utcnow()
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=fields.get("branch_id"),
            asset_id=fields["asset_id"],
            maintenance_id=fields["maintenance_id"],
            service_summary=str(fields["service_summary"]).strip(),
            parts_replaced_json=fields.get("parts_replaced_json"),
            cost_amount=fields.get("cost_amount"),
            serviced_at=serviced_at,
            status=AssetServiceHistoryStatus.RECORDED.value,
        )
        self._engine.record(row)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_SERVICE_HISTORY,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "asset_id": str(row.asset_id),
                "maintenance_id": str(row.maintenance_id),
            },
        )
        return row

    def record_from_maintenance(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID | None,
        asset_id: UUID,
        maintenance_id: UUID,
        service_summary: str,
        cost_amount: Decimal | None = None,
        serviced_at: datetime | None = None,
    ) -> AstAssetServiceHistory:
        """Auto-record from MaintenanceService.complete().

        Intentionally skips Service History audit logging: the parent maintenance
        completion is already audited by MaintenanceService, and duplicating an
        audit row for the derived history record would add noise without changing
        the immutable log semantics (ADR-ASSET-SVH-001 SVH-14).
        """
        when = serviced_at or utcnow()
        row = self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            asset_id=asset_id,
            maintenance_id=maintenance_id,
            service_summary=service_summary,
            cost_amount=cost_amount,
            serviced_at=when,
            status=AssetServiceHistoryStatus.RECORDED.value,
        )
        self._engine.record(row)
        return row
