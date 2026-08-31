"""Asset maintenance plan validation rules for FP-ASSET-011."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetMaintenancePlanStatus, AssetStatus
from modules.asset.domain.exceptions import MaintenancePlanValidationError
from modules.asset.models import AstAssetMaintenancePlan
from modules.asset.repository.asset_maintenance_plan_repository import (
    AssetMaintenancePlanRepository,
)
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

MAINTENANCE_TYPES = frozenset({"preventive", "corrective", "emergency", "annual_service"})
ELIGIBLE_ASSET_STATUSES = frozenset(
    {
        AssetStatus.ACTIVE.value,
        AssetStatus.IN_MAINTENANCE.value,
        AssetStatus.TRANSFERRED.value,
    }
)
EDITABLE_STATUSES = frozenset(
    {
        AssetMaintenancePlanStatus.DRAFT.value,
        AssetMaintenancePlanStatus.ACTIVE.value,
        AssetMaintenancePlanStatus.PAUSED.value,
    }
)


class MaintenancePlanValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._plans = AssetMaintenancePlanRepository(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        if fields.get("document_number"):
            raise MaintenancePlanValidationError("document_number is system-assigned")
        if fields.get("status") and fields["status"] != AssetMaintenancePlanStatus.DRAFT.value:
            raise MaintenancePlanValidationError("New maintenance plans must start in draft status")

        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise MaintenancePlanValidationError("asset_id is required")

        plan_name = fields.get("plan_name")
        if not plan_name or not str(plan_name).strip():
            raise MaintenancePlanValidationError("plan_name is required")

        maintenance_type = fields.get("maintenance_type")
        if maintenance_type not in MAINTENANCE_TYPES:
            raise MaintenancePlanValidationError(
                "maintenance_type must be preventive, corrective, emergency, or annual_service"
            )

        self._validate_frequencies(
            fields.get("frequency_days"),
            fields.get("frequency_meter_units"),
        )

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise MaintenancePlanValidationError("Asset does not belong to this company")
        self._validate_asset_eligible(asset.status)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetMaintenancePlan,
        fields: dict,
    ) -> None:
        if row.status not in EDITABLE_STATUSES:
            raise MaintenancePlanValidationError(
                "Only draft, active, or paused maintenance plans can be updated"
            )
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise MaintenancePlanValidationError("asset_id cannot be changed")
        if "document_number" in fields:
            raise MaintenancePlanValidationError("document_number cannot be changed")
        if "status" in fields and fields["status"] is not None and fields["status"] != row.status:
            raise MaintenancePlanValidationError("status cannot be changed via update")

        plan_name = fields.get("plan_name", row.plan_name)
        if not plan_name or not str(plan_name).strip():
            raise MaintenancePlanValidationError("plan_name is required")

        maintenance_type = fields.get("maintenance_type", row.maintenance_type)
        if maintenance_type not in MAINTENANCE_TYPES:
            raise MaintenancePlanValidationError(
                "maintenance_type must be preventive, corrective, emergency, or annual_service"
            )

        self._validate_frequencies(
            fields.get("frequency_days", row.frequency_days),
            fields.get("frequency_meter_units", row.frequency_meter_units),
        )
        self._validate_row_asset(ctx, row)

    def validate_activate_readiness(self, ctx: TenantContext, row: AstAssetMaintenancePlan) -> None:
        if row.status != AssetMaintenancePlanStatus.DRAFT.value:
            raise MaintenancePlanValidationError("Only draft maintenance plans can be activated")
        if row.next_due_date is None:
            raise MaintenancePlanValidationError("next_due_date is required before activate")
        if not row.plan_name or not row.maintenance_type:
            raise MaintenancePlanValidationError(
                "plan_name and maintenance_type are required before activate"
            )
        self._validate_row_asset(ctx, row)

    def validate_pause_readiness(self, ctx: TenantContext, row: AstAssetMaintenancePlan) -> None:
        if row.status != AssetMaintenancePlanStatus.ACTIVE.value:
            raise MaintenancePlanValidationError("Only active maintenance plans can be paused")
        self._validate_row_asset(ctx, row)

    def validate_resume_readiness(self, ctx: TenantContext, row: AstAssetMaintenancePlan) -> None:
        if row.status != AssetMaintenancePlanStatus.PAUSED.value:
            raise MaintenancePlanValidationError("Only paused maintenance plans can be resumed")
        self._validate_row_asset(ctx, row)

    def validate_close_readiness(self, ctx: TenantContext, row: AstAssetMaintenancePlan) -> None:
        if row.status not in {
            AssetMaintenancePlanStatus.ACTIVE.value,
            AssetMaintenancePlanStatus.PAUSED.value,
        }:
            raise MaintenancePlanValidationError(
                "Only active or paused maintenance plans can be closed"
            )

    def validate_plan_link_for_work_order(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        maintenance_plan_id: UUID,
    ) -> None:
        plan = self._plans.get(ctx, maintenance_plan_id)
        if plan is None:
            raise MaintenancePlanValidationError("maintenance_plan_id is invalid")
        if plan.asset_id != asset_id:
            raise MaintenancePlanValidationError(
                "maintenance_plan_id does not belong to the selected asset"
            )
        if plan.status != AssetMaintenancePlanStatus.ACTIVE.value:
            raise MaintenancePlanValidationError(
                "maintenance_plan_id must reference an active maintenance plan"
            )

    def _validate_row_asset(self, ctx: TenantContext, row: AstAssetMaintenancePlan) -> None:
        if row.asset_id is None:
            raise MaintenancePlanValidationError("asset_id is required")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset.status)

    @staticmethod
    def _validate_frequencies(
        frequency_days: int | None,
        frequency_meter_units: Decimal | float | int | None,
    ) -> None:
        if frequency_days is not None and int(frequency_days) < 0:
            raise MaintenancePlanValidationError("frequency_days cannot be negative")
        if frequency_meter_units is not None and Decimal(str(frequency_meter_units)) < 0:
            raise MaintenancePlanValidationError("frequency_meter_units cannot be negative")

    @staticmethod
    def _validate_asset_eligible(status: str) -> None:
        if status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value}:
            raise MaintenancePlanValidationError(
                "Disposed or written-off assets cannot have maintenance plans"
            )
        if status == AssetStatus.CANCELLED.value:
            raise MaintenancePlanValidationError(
                "Cancelled assets cannot have maintenance plans"
            )
        if status not in ELIGIBLE_ASSET_STATUSES:
            raise MaintenancePlanValidationError(
                "Only active, in_maintenance, or transferred assets can have maintenance plans"
            )
