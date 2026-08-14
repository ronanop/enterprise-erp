"""Asset maintenance work-order validation rules for FP-ASSET-004."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetMaintenanceStatus, AssetStatus
from modules.asset.domain.exceptions import MaintenanceValidationError
from modules.asset.domain.operational_status_rules import (
    OPS_BLOCKED_FOR_MAINTENANCE_OR_TRANSFER,
)
from modules.asset.models import AstAssetMaintenance
from modules.asset.repository.asset_assignment_repository import AssetAssignmentRepository
from modules.asset.repository.asset_maintenance_repository import AssetMaintenanceRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_transfer_repository import AssetTransferRepository
from modules.asset.service.maintenance_plan_validator import MaintenancePlanValidator
from modules.foundation.domain.value_objects import TenantContext

MAINTENANCE_TYPES = frozenset({"preventive", "corrective", "emergency", "annual_service"})
OPEN_STATUSES = frozenset(
    {
        AssetMaintenanceStatus.DRAFT.value,
        AssetMaintenanceStatus.SUBMITTED.value,
        AssetMaintenanceStatus.APPROVED.value,
        AssetMaintenanceStatus.SCHEDULED.value,
        AssetMaintenanceStatus.IN_PROGRESS.value,
    }
)

_ASSIGNED_BLOCK_MESSAGE = (
    "Asset is currently assigned. Return the asset before starting maintenance."
)


class MaintenanceValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._maintenances = AssetMaintenanceRepository(db)
        self._transfers = AssetTransferRepository(db)
        self._assignments = AssetAssignmentRepository(db)
        self._master = AssetMasterDataAdapter(db)
        self._plan_validator = MaintenancePlanValidator(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise MaintenanceValidationError("asset_id is required")
        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_serviceable(asset.status)
        self._validate_operational_allows_maintenance(
            getattr(asset, "operational_status", None)
        )
        self._validate_no_open_assignment(ctx, asset_id)
        if asset.company_id != company_id:
            raise MaintenanceValidationError("Asset does not belong to this company")
        self._validate_type_and_refs(ctx, fields, asset_id=asset_id)
        self._validate_open_work_order(ctx, asset_id, exclude_id=None)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetMaintenance,
        fields: dict,
    ) -> None:
        if row.status != AssetMaintenanceStatus.DRAFT.value:
            raise MaintenanceValidationError("Only draft maintenance can be updated")
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise MaintenanceValidationError("asset_id cannot be changed")
        if "document_number" in fields:
            raise MaintenanceValidationError("document_number cannot be changed")
        merged = {
            "maintenance_type": fields.get("maintenance_type", row.maintenance_type),
            "vendor_id": fields.get("vendor_id", row.vendor_id),
            "technician_employee_id": fields.get(
                "technician_employee_id", row.technician_employee_id
            ),
            "maintenance_plan_id": fields.get("maintenance_plan_id", row.maintenance_plan_id),
            "scheduled_date": fields.get("scheduled_date", row.scheduled_date),
            "cost_amount": fields.get("cost_amount", row.cost_amount),
        }
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_serviceable(asset.status)
        self._validate_operational_allows_maintenance(
            getattr(asset, "operational_status", None)
        )
        self._validate_no_open_assignment(ctx, row.asset_id)
        self._validate_type_and_refs(ctx, merged, asset_id=row.asset_id)
        self._validate_open_work_order(ctx, row.asset_id, exclude_id=row.id)

    def validate_submit_readiness(self, ctx: TenantContext, row: AstAssetMaintenance) -> None:
        if row.status != AssetMaintenanceStatus.DRAFT.value:
            raise MaintenanceValidationError("Only draft maintenance can be submitted")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_serviceable(asset.status)
        self._validate_operational_allows_maintenance(
            getattr(asset, "operational_status", None)
        )
        self._validate_no_open_assignment(ctx, row.asset_id)
        self._validate_type_and_refs(
            ctx,
            {
                "maintenance_type": row.maintenance_type,
                "vendor_id": row.vendor_id,
                "technician_employee_id": row.technician_employee_id,
                "maintenance_plan_id": row.maintenance_plan_id,
            },
            asset_id=row.asset_id,
        )
        self._validate_open_work_order(ctx, row.asset_id, exclude_id=row.id)

    def validate_approve_readiness(self, ctx: TenantContext, row: AstAssetMaintenance) -> None:
        if row.status != AssetMaintenanceStatus.SUBMITTED.value:
            raise MaintenanceValidationError("Only submitted maintenance can be approved")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_serviceable(asset.status)
        self._validate_operational_allows_maintenance(
            getattr(asset, "operational_status", None)
        )
        self._validate_no_open_assignment(ctx, row.asset_id)

    def validate_start_readiness(self, ctx: TenantContext, row: AstAssetMaintenance) -> None:
        if row.status not in {
            AssetMaintenanceStatus.APPROVED.value,
            AssetMaintenanceStatus.SCHEDULED.value,
        }:
            raise MaintenanceValidationError("Only approved or scheduled maintenance can be started")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_serviceable(asset.status)
        self._validate_operational_allows_maintenance(
            getattr(asset, "operational_status", None)
        )
        self._validate_no_open_assignment(ctx, row.asset_id)
        self._validate_pending_transfer(ctx, row.asset_id)

    def validate_complete_readiness(self, ctx: TenantContext, row: AstAssetMaintenance) -> None:
        if row.status not in {
            AssetMaintenanceStatus.APPROVED.value,
            AssetMaintenanceStatus.SCHEDULED.value,
            AssetMaintenanceStatus.IN_PROGRESS.value,
        }:
            raise MaintenanceValidationError("Maintenance is not completable")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.status not in {
            AssetStatus.ACTIVE.value,
            AssetStatus.IN_MAINTENANCE.value,
        }:
            raise MaintenanceValidationError("Asset is not in a serviceable state for completion")

    def validate_reopen_readiness(self, ctx: TenantContext, row: AstAssetMaintenance) -> None:
        """Ensure reopening does not create a second open work order (MNT-03)."""
        self._validate_open_work_order(ctx, row.asset_id, exclude_id=row.id)

    def _validate_type_and_refs(
        self,
        ctx: TenantContext,
        fields: dict,
        *,
        asset_id: UUID,
    ) -> None:
        maintenance_type = fields.get("maintenance_type")
        if maintenance_type not in MAINTENANCE_TYPES:
            raise MaintenanceValidationError("maintenance_type is required and must be valid")
        vendor_id = fields.get("vendor_id")
        if vendor_id is not None:
            self._master.get_vendor(ctx, vendor_id)
        technician_id = fields.get("technician_employee_id")
        if technician_id is not None:
            self._master.get_employee(ctx, technician_id)
        maintenance_plan_id = fields.get("maintenance_plan_id")
        if maintenance_plan_id is not None:
            self._plan_validator.validate_plan_link_for_work_order(
                ctx,
                asset_id=asset_id,
                maintenance_plan_id=maintenance_plan_id,
            )

    def _validate_open_work_order(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        exclude_id: UUID | None,
    ) -> None:
        open_row = self._maintenances.find_open_for_asset(ctx, asset_id, exclude_id=exclude_id)
        if open_row is not None:
            raise MaintenanceValidationError(
                f"Asset already has an open maintenance work order ({open_row.document_number})"
            )

    def _validate_pending_transfer(self, ctx: TenantContext, asset_id: UUID) -> None:
        pending = self._transfers.find_pending_for_asset(ctx, asset_id, exclude_id=None)
        if pending is not None:
            raise MaintenanceValidationError(
                f"Asset has a pending transfer ({pending.document_number})"
            )

    def _validate_no_open_assignment(self, ctx: TenantContext, asset_id: UUID) -> None:
        open_asn = self._assignments.find_pending_or_active_for_asset(
            ctx, asset_id, exclude_id=None
        )
        if open_asn is not None:
            raise MaintenanceValidationError(_ASSIGNED_BLOCK_MESSAGE)

    @staticmethod
    def _validate_asset_is_serviceable(status: str) -> None:
        if status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value}:
            raise MaintenanceValidationError("Disposed or written-off assets cannot be maintained")
        if status not in {AssetStatus.ACTIVE.value, AssetStatus.IN_MAINTENANCE.value}:
            raise MaintenanceValidationError(
                "Only active or in_maintenance assets can have maintenance work orders"
            )

    @staticmethod
    def _validate_operational_allows_maintenance(operational_status: str | None) -> None:
        ops = str(operational_status or "").strip().upper()
        if ops in OPS_BLOCKED_FOR_MAINTENANCE_OR_TRANSFER:
            raise MaintenanceValidationError(
                "Retired, pending disposal, or disposed assets cannot enter maintenance."
            )
