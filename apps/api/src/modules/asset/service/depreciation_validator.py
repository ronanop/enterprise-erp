"""Asset depreciation validation rules for FP-ASSET-006."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetDepreciationStatus, AssetStatus
from modules.asset.domain.exceptions import DepreciationValidationError
from modules.asset.models import AstAssetDepreciation
from modules.asset.repository.asset_depreciation_repository import AssetDepreciationRepository
from modules.asset.repository.asset_disposal_repository import AssetDisposalRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

METHODS = frozenset({"straight_line", "wdv", "units_of_production"})
ELIGIBLE_ASSET_STATUSES = frozenset(
    {
        AssetStatus.ACTIVE.value,
        AssetStatus.IN_MAINTENANCE.value,
    }
)


class DepreciationValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._deps = AssetDepreciationRepository(db)
        self._disposals = AssetDisposalRepository(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise DepreciationValidationError("asset_id is required")
        period_year = fields.get("period_year")
        period_month = fields.get("period_month")
        if period_year is None or period_month is None:
            raise DepreciationValidationError("period_year and period_month are required")
        if not (1 <= int(period_month) <= 12):
            raise DepreciationValidationError("period_month must be between 1 and 12")
        method = fields.get("method")
        if method not in METHODS:
            raise DepreciationValidationError("method is required and must be valid")

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise DepreciationValidationError("Asset does not belong to this company")
        self._validate_asset_eligible(asset, method=method)
        self._validate_purchase_period(asset, int(period_year), int(period_month))
        self._validate_open_disposal(ctx, asset_id)
        self._validate_period_unique(
            ctx, asset_id, int(period_year), int(period_month), exclude_id=None
        )

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetDepreciation,
        fields: dict,
    ) -> None:
        if row.status != AssetDepreciationStatus.DRAFT.value:
            raise DepreciationValidationError("Only draft depreciation can be updated")
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise DepreciationValidationError("asset_id cannot be changed")
        if "document_number" in fields or "idempotency_key" in fields:
            raise DepreciationValidationError("document_number/idempotency_key cannot be changed")

        period_year = fields.get("period_year", row.period_year)
        period_month = fields.get("period_month", row.period_month)
        method = fields.get("method", row.method)
        if method not in METHODS:
            raise DepreciationValidationError("method is required and must be valid")
        if not (1 <= int(period_month) <= 12):
            raise DepreciationValidationError("period_month must be between 1 and 12")

        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset, method=method)
        self._validate_purchase_period(asset, int(period_year), int(period_month))
        self._validate_open_disposal(ctx, row.asset_id)
        self._validate_period_unique(
            ctx, row.asset_id, int(period_year), int(period_month), exclude_id=row.id
        )

    def validate_calculate_readiness(
        self,
        ctx: TenantContext,
        row: AstAssetDepreciation,
        *,
        estimated_total_units=None,
    ) -> None:
        if row.status not in {
            AssetDepreciationStatus.DRAFT.value,
            AssetDepreciationStatus.FAILED.value,
        }:
            raise DepreciationValidationError("Only draft or failed depreciation can be calculated")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset, method=row.method)
        self._validate_open_disposal(ctx, row.asset_id)
        if row.method == "units_of_production":
            if row.units_produced is None or estimated_total_units is None:
                raise DepreciationValidationError(
                    "units_produced and estimated_total_units are required for units_of_production"
                )

    def validate_post_readiness(self, ctx: TenantContext, row: AstAssetDepreciation) -> None:
        if (
            row.status == AssetDepreciationStatus.POSTED.value
            or row.finance_journal_id is not None
        ):
            raise DepreciationValidationError("Depreciation already posted")
        if row.status != AssetDepreciationStatus.CALCULATED.value:
            raise DepreciationValidationError("Only calculated depreciation can be posted")
        if row.depreciation_amount is None or row.depreciation_amount <= 0:
            raise DepreciationValidationError("depreciation_amount must be positive before posting")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset, method=row.method)
        self._validate_open_disposal(ctx, row.asset_id)

    def validate_reverse_readiness(self, ctx: TenantContext, row: AstAssetDepreciation) -> None:
        if row.status == AssetDepreciationStatus.REVERSED.value:
            raise DepreciationValidationError("Depreciation already reversed")
        if row.status != AssetDepreciationStatus.POSTED.value:
            raise DepreciationValidationError("Only posted depreciation can be reversed")
        if row.depreciation_amount is None:
            raise DepreciationValidationError("Cannot reverse without depreciation_amount")

    def _validate_period_unique(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        period_year: int,
        period_month: int,
        *,
        exclude_id: UUID | None,
    ) -> None:
        existing = self._deps.find_for_asset_period(
            ctx,
            asset_id,
            period_year,
            period_month,
            exclude_id=exclude_id,
            exclude_reversed=True,
        )
        if existing is not None:
            raise DepreciationValidationError(
                f"Asset already has depreciation for {period_year}-{period_month:02d} "
                f"({existing.document_number})"
            )

    def _validate_open_disposal(self, ctx: TenantContext, asset_id: UUID) -> None:
        pending = self._disposals.find_pending_for_asset(ctx, asset_id, exclude_id=None)
        if pending is not None:
            raise DepreciationValidationError(
                f"Asset has an open disposal ({pending.document_number})"
            )

    @staticmethod
    def _validate_asset_eligible(asset, *, method: str | None = None) -> None:
        if asset.status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value}:
            raise DepreciationValidationError("Disposed or written-off assets cannot be depreciated")
        if asset.status not in ELIGIBLE_ASSET_STATUSES:
            raise DepreciationValidationError(
                "Only active or in_maintenance assets can be depreciated"
            )
        if asset.purchase_cost is None:
            raise DepreciationValidationError("Asset purchase_cost is required for depreciation")
        effective = method or asset.depreciation_method
        if effective != "units_of_production":
            if asset.useful_life_months is None or int(asset.useful_life_months) <= 0:
                raise DepreciationValidationError(
                    "Asset useful_life_months is required for depreciation"
                )

    @staticmethod
    def _validate_purchase_period(asset, period_year: int, period_month: int) -> None:
        if asset.purchase_date is None:
            return
        purchase: date = asset.purchase_date
        if (period_year, period_month) < (purchase.year, purchase.month):
            raise DepreciationValidationError(
                "Depreciation period cannot be before the asset purchase month"
            )
