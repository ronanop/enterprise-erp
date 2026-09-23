"""MeterReadingService — asset meter reading management (FP-ASSET-015)."""

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetMeterReadingStatus
from modules.asset.models import AstAssetMeterReading
from modules.asset.repository.asset_meter_reading_repository import (
    AssetMeterReadingListFilters,
    AssetMeterReadingRepository,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.engines import AssetMeterReadingEngine
from modules.asset.service.meter_reading_validator import MeterReadingValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_METER_READING = "ast_asset_meter_reading"


class MeterReadingService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetMeterReadingRepository(db)
        self._scope = AssetScopeValidator(db)
        self._engine = AssetMeterReadingEngine()
        self._audit = AuditService(db)
        self._validator = MeterReadingValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        meter_type: str | None = None,
        branch_id: UUID | None = None,
        status: str | None = None,
        reading_from: datetime | None = None,
        reading_to: datetime | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetMeterReading], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetMeterReadingListFilters(
            company_id=cid,
            asset_id=asset_id,
            meter_type=meter_type,
            branch_id=branch_id,
            status=status,
            reading_from=reading_from,
            reading_to=reading_to,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetMeterReading:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Meter reading not found")
        return row

    def get_latest_reading(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        meter_type: str,
    ) -> AstAssetMeterReading | None:
        return self._repo.find_latest_reading(ctx, asset_id, meter_type)

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        fields.pop("status", None)
        asset_id = fields.get("asset_id")
        meter_type = fields.get("meter_type")
        if asset_id is not None and meter_type is not None:
            self._repo.lock_create_scope(ctx, asset_id, str(meter_type).strip())

        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=fields.get("branch_id"),
            asset_id=fields["asset_id"],
            meter_type=str(fields["meter_type"]).strip(),
            reading_value=fields["reading_value"],
            reading_at=fields["reading_at"],
            recorded_by_employee_id=fields.get("recorded_by_employee_id"),
            status=AssetMeterReadingStatus.RECORDED.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_METER_READING,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "asset_id": str(row.asset_id),
                "meter_type": row.meter_type,
                "reading_value": str(row.reading_value),
            },
        )
        return row

    def void(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_void_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Meter reading not found")
        self._engine.void(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_METER_READING,
            entity_id=row_id,
            operation="void",
            performed_by=ctx.user_id,
        )
        return updated
