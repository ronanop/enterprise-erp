"""Asset service history validation rules for FP-ASSET-013."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetMaintenanceStatus, AssetServiceHistoryStatus, AssetStatus
from modules.asset.domain.exceptions import ServiceHistoryValidationError
from modules.asset.repository.asset_maintenance_repository import AssetMaintenanceRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext


_MANUAL_CREATE_BLOCKED_ASSET_STATUSES = frozenset(
    {
        AssetStatus.DISPOSED.value,
        AssetStatus.WRITTEN_OFF.value,
        "permanently_retired",
    }
)


class ServiceHistoryValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._maintenances = AssetMaintenanceRepository(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        if fields.get("status") and fields["status"] != AssetServiceHistoryStatus.RECORDED.value:
            raise ServiceHistoryValidationError("Service history must be recorded status")

        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise ServiceHistoryValidationError("asset_id is required")

        maintenance_id = fields.get("maintenance_id")
        if maintenance_id is None:
            raise ServiceHistoryValidationError("maintenance_id is required")

        service_summary = fields.get("service_summary")
        if not service_summary or not str(service_summary).strip():
            raise ServiceHistoryValidationError("service_summary is required")

        maintenance = self._maintenances.get(ctx, maintenance_id)
        if maintenance is None:
            raise ServiceHistoryValidationError("maintenance_id is invalid")
        if maintenance.company_id != company_id:
            raise ServiceHistoryValidationError("Maintenance does not belong to this company")
        if maintenance.status != AssetMaintenanceStatus.COMPLETED.value:
            raise ServiceHistoryValidationError(
                "maintenance_id must reference a completed maintenance work order"
            )
        if maintenance.asset_id != asset_id:
            raise ServiceHistoryValidationError("asset_id must match the selected maintenance work order")

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise ServiceHistoryValidationError("Asset does not belong to this company")
        if asset.status in _MANUAL_CREATE_BLOCKED_ASSET_STATUSES:
            raise ServiceHistoryValidationError(
                "Supplemental service history cannot be created for disposed, "
                "written-off, or permanently retired assets"
            )

        cost_amount = fields.get("cost_amount")
        if cost_amount is not None and Decimal(str(cost_amount)) < 0:
            raise ServiceHistoryValidationError("cost_amount cannot be negative")

        parts = fields.get("parts_replaced_json")
        if parts is not None and not isinstance(parts, (dict, list)):
            raise ServiceHistoryValidationError("parts_replaced_json must be an object or array")
