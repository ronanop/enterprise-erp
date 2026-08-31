"""Asset location validation rules for FP-ASSET-012."""

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetLocationStatus, AssetStatus
from modules.asset.domain.exceptions import LocationValidationError
from modules.asset.models import AstAssetLocation
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

# ADR-ASSET-LOC-001 LOC-08: block terminal assets only.
# Phase 4A registration persists location on draft create, so pre-active
# lifecycle statuses are eligible alongside live/custody statuses.
ELIGIBLE_ASSET_STATUSES = frozenset(
    {
        AssetStatus.DRAFT.value,
        AssetStatus.SUBMITTED.value,
        AssetStatus.APPROVED.value,
        AssetStatus.ACTIVE.value,
        AssetStatus.IN_MAINTENANCE.value,
        AssetStatus.TRANSFERRED.value,
    }
)


class LocationValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        if fields.get("status") and fields["status"] != AssetLocationStatus.ACTIVE.value:
            raise LocationValidationError("New locations must start in active status")
        if fields.get("is_current") is False:
            raise LocationValidationError("New locations must be marked as current")

        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise LocationValidationError("asset_id is required")

        location_label = fields.get("location_label")
        if not location_label or not str(location_label).strip():
            raise LocationValidationError("location_label is required")

        effective_from = fields.get("effective_from")
        effective_to = fields.get("effective_to")
        if effective_to is not None:
            raise LocationValidationError("effective_to cannot be set on create")
        self._validate_dates(effective_from, None)

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise LocationValidationError("Asset does not belong to this company")
        self._validate_asset_eligible(asset.status)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetLocation,
        fields: dict,
    ) -> None:
        if row.status != AssetLocationStatus.ACTIVE.value:
            raise LocationValidationError("Only active locations can be updated")
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise LocationValidationError("asset_id cannot be changed")
        if "status" in fields and fields["status"] is not None and fields["status"] != row.status:
            raise LocationValidationError("status cannot be changed via update")
        if "is_current" in fields and fields["is_current"] is not None:
            raise LocationValidationError("is_current cannot be changed via update")

        location_label = fields.get("location_label", row.location_label)
        if not location_label or not str(location_label).strip():
            raise LocationValidationError("location_label is required")

        effective_from = fields.get("effective_from", row.effective_from)
        effective_to = fields.get("effective_to", row.effective_to)
        self._validate_dates(effective_from, effective_to)
        self._validate_row_asset(ctx, row)

    def validate_complete_readiness(self, ctx: TenantContext, row: AstAssetLocation) -> None:
        if row.status != AssetLocationStatus.ACTIVE.value:
            raise LocationValidationError("Only active locations can be completed")
        if not row.is_current:
            raise LocationValidationError("Only current locations can be completed")
        self._validate_row_asset(ctx, row)

    def _validate_row_asset(self, ctx: TenantContext, row: AstAssetLocation) -> None:
        if row.asset_id is None:
            raise LocationValidationError("asset_id is required")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset.status)

    @staticmethod
    def _validate_dates(
        effective_from: datetime | None,
        effective_to: datetime | None,
    ) -> None:
        if effective_from is not None and effective_to is not None and effective_from > effective_to:
            raise LocationValidationError("effective_from must be on or before effective_to")

    @staticmethod
    def _validate_asset_eligible(status: str) -> None:
        if status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value}:
            raise LocationValidationError(
                "Disposed or written-off assets cannot have location records"
            )
        if status == AssetStatus.CANCELLED.value:
            raise LocationValidationError("Cancelled assets cannot have location records")
        if status not in ELIGIBLE_ASSET_STATUSES:
            raise LocationValidationError(
                "Asset status does not allow location records"
            )
