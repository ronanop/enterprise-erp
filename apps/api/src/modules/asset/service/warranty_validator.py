"""Asset warranty validation rules for FP-ASSET-009."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetStatus, AssetWarrantyStatus
from modules.asset.domain.exceptions import WarrantyValidationError
from modules.asset.models import AstAssetWarranty
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_warranty_repository import AssetWarrantyRepository
from modules.foundation.domain.value_objects import TenantContext

WARRANTY_TYPES = frozenset({"manufacturer", "extended", "service"})
ELIGIBLE_ASSET_STATUSES = frozenset(
    {
        AssetStatus.ACTIVE.value,
        AssetStatus.IN_MAINTENANCE.value,
        AssetStatus.TRANSFERRED.value,
    }
)
OPEN_WARRANTY_STATUSES = frozenset(
    {
        AssetWarrantyStatus.ACTIVE.value,
        AssetWarrantyStatus.EXTENDED.value,
    }
)
EDITABLE_STATUSES = frozenset(
    {
        AssetWarrantyStatus.DRAFT.value,
        AssetWarrantyStatus.ACTIVE.value,
    }
)


class WarrantyValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._warranties = AssetWarrantyRepository(db)
        self._master = AssetMasterDataAdapter(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise WarrantyValidationError("asset_id is required")

        start_date = fields.get("start_date")
        end_date = fields.get("end_date")
        if start_date is None:
            raise WarrantyValidationError("start_date is required")
        if end_date is None:
            raise WarrantyValidationError("end_date is required")
        self._validate_dates(start_date, end_date)

        warranty_type = fields.get("warranty_type")
        if warranty_type not in WARRANTY_TYPES:
            raise WarrantyValidationError(
                "warranty_type must be manufacturer, extended, or service"
            )

        vendor_id = fields.get("vendor_id")
        if warranty_type in {"extended", "service"} and vendor_id is None:
            raise WarrantyValidationError(
                "vendor_id (provider) is required for extended and service warranties"
            )
        if vendor_id is not None:
            self._validate_vendor(ctx, vendor_id)

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise WarrantyValidationError("Asset does not belong to this company")
        self._validate_asset_eligible(asset.status)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetWarranty,
        fields: dict,
    ) -> None:
        if row.status not in EDITABLE_STATUSES:
            raise WarrantyValidationError("Only draft or active warranties can be updated")
        if row.status == AssetWarrantyStatus.EXPIRED.value:
            raise WarrantyValidationError("Expired warranties cannot be updated")
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise WarrantyValidationError("asset_id cannot be changed")
        if "status" in fields and fields["status"] is not None and fields["status"] != row.status:
            raise WarrantyValidationError("status cannot be changed via update")

        if (
            row.status == AssetWarrantyStatus.ACTIVE.value
            and "end_date" in fields
            and fields["end_date"] is not None
            and fields["end_date"] != row.end_date
        ):
            raise WarrantyValidationError(
                "end_date cannot be changed on an active warranty; use POST /extend"
            )

        start_date = fields.get("start_date", row.start_date)
        end_date = fields.get("end_date", row.end_date)
        if row.status == AssetWarrantyStatus.ACTIVE.value:
            end_date = row.end_date
        self._validate_dates(start_date, end_date)

        warranty_type = fields.get("warranty_type", row.warranty_type)
        if warranty_type not in WARRANTY_TYPES:
            raise WarrantyValidationError(
                "warranty_type must be manufacturer, extended, or service"
            )

        vendor_id = fields.get("vendor_id", row.vendor_id)
        if warranty_type in {"extended", "service"} and vendor_id is None:
            raise WarrantyValidationError(
                "vendor_id (provider) is required for extended and service warranties"
            )
        if vendor_id is not None:
            self._validate_vendor(ctx, vendor_id)

        self._validate_row_asset(ctx, row)

    def validate_activate_readiness(self, ctx: TenantContext, row: AstAssetWarranty) -> None:
        if row.status != AssetWarrantyStatus.DRAFT.value:
            raise WarrantyValidationError("Only draft warranties can be activated")
        self._validate_dates(row.start_date, row.end_date)
        if row.warranty_type not in WARRANTY_TYPES:
            raise WarrantyValidationError("warranty_type is invalid")
        if row.warranty_type in {"extended", "service"} and row.vendor_id is None:
            raise WarrantyValidationError(
                "vendor_id (provider) is required before activate"
            )
        self._validate_row_asset(ctx, row)
        self._validate_no_open_warranty(ctx, row)

    def validate_extend_readiness(
        self,
        ctx: TenantContext,
        row: AstAssetWarranty,
        *,
        new_end_date: date,
    ) -> None:
        if row.status != AssetWarrantyStatus.ACTIVE.value:
            raise WarrantyValidationError("Only active warranties can be extended")
        if new_end_date is None:
            raise WarrantyValidationError("new_end_date is required")
        if new_end_date <= row.end_date:
            raise WarrantyValidationError("new_end_date must be greater than current end_date")
        if new_end_date < row.start_date:
            raise WarrantyValidationError("new_end_date must be on or after start_date")
        self._validate_row_asset(ctx, row)

    def validate_expire_readiness(self, ctx: TenantContext, row: AstAssetWarranty) -> None:
        if row.status not in OPEN_WARRANTY_STATUSES:
            raise WarrantyValidationError(
                "Only active or extended warranties can be expired"
            )
        if row.status == AssetWarrantyStatus.EXPIRED.value:
            raise WarrantyValidationError("Warranty is already expired")

    def _validate_no_open_warranty(self, ctx: TenantContext, row: AstAssetWarranty) -> None:
        existing = self._warranties.find_open_for_asset(
            ctx,
            company_id=row.company_id,
            asset_id=row.asset_id,
            exclude_id=row.id,
        )
        if existing is not None:
            raise WarrantyValidationError(
                "Asset already has an active or extended warranty"
            )

    def _validate_row_asset(self, ctx: TenantContext, row: AstAssetWarranty) -> None:
        if row.asset_id is None:
            raise WarrantyValidationError("asset_id is required")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset.status)

    def _validate_vendor(self, ctx: TenantContext, vendor_id: UUID) -> None:
        try:
            vendor = self._master.get_vendor(ctx, vendor_id)
        except Exception as exc:  # noqa: BLE001
            raise WarrantyValidationError("vendor_id is invalid") from exc
        if vendor is None:
            raise WarrantyValidationError("vendor_id is invalid")

    @staticmethod
    def _validate_dates(start_date: date, end_date: date) -> None:
        if start_date is None or end_date is None:
            raise WarrantyValidationError("start_date and end_date are required")
        if start_date > end_date:
            raise WarrantyValidationError("start_date must be on or before end_date")

    @staticmethod
    def _validate_asset_eligible(status: str) -> None:
        if status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value}:
            raise WarrantyValidationError(
                "Disposed or written-off assets cannot have warranties"
            )
        if status not in ELIGIBLE_ASSET_STATUSES:
            raise WarrantyValidationError(
                "Only active, in_maintenance, or transferred assets can have warranties"
            )
