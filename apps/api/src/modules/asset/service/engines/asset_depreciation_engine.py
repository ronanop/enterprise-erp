"""AssetDepreciation lifecycle + calculation engine (FP-ASSET-006)."""

from decimal import ROUND_HALF_UP, Decimal

from modules.asset.domain.enums import AssetDepreciationStatus
from modules.asset.domain.exceptions import InvalidAssetDepreciationState
from modules.asset.domain.value_objects import DepreciationAmount

ZERO = Decimal("0.0000")
QUANT = Decimal("0.0001")


class AssetDepreciationEngine:
    def calculate(
        self,
        row,
        *,
        asset,
        estimated_total_units: Decimal | None = None,
    ) -> DepreciationAmount:
        if row.status not in {
            AssetDepreciationStatus.DRAFT.value,
            AssetDepreciationStatus.FAILED.value,
        }:
            raise InvalidAssetDepreciationState(
                "Only draft or failed depreciation can be calculated"
            )

        result = self._compute(row, asset=asset, estimated_total_units=estimated_total_units)
        if result.amount <= ZERO:
            raise InvalidAssetDepreciationState(
                "Depreciation amount must be greater than zero (asset may be fully depreciated)"
            )
        row.depreciation_amount = result.amount
        row.book_value_after = result.book_value_after
        row.status = AssetDepreciationStatus.CALCULATED.value
        return result

    def post(self, row) -> None:
        if row.status != AssetDepreciationStatus.CALCULATED.value:
            raise InvalidAssetDepreciationState("Only calculated depreciation can be posted")
        row.status = AssetDepreciationStatus.POSTED.value

    def fail(self, row) -> None:
        row.status = AssetDepreciationStatus.FAILED.value

    def reverse(self, row) -> None:
        if row.status != AssetDepreciationStatus.POSTED.value:
            raise InvalidAssetDepreciationState("Only posted depreciation can be reversed")
        row.status = AssetDepreciationStatus.REVERSED.value

    def _compute(
        self,
        row,
        *,
        asset,
        estimated_total_units: Decimal | None,
    ) -> DepreciationAmount:
        cost = Decimal(str(asset.purchase_cost or 0))
        salvage = Decimal(str(asset.salvage_value or 0))
        book = Decimal(
            str(
                asset.current_book_value
                if asset.current_book_value is not None
                else asset.purchase_cost or 0
            )
        )
        if book < salvage:
            book = salvage
        depreciable = cost - salvage
        if depreciable < ZERO:
            depreciable = ZERO

        method = row.method
        life = int(asset.useful_life_months or 0)

        if method == "straight_line":
            if life <= 0:
                raise InvalidAssetDepreciationState("useful_life_months is required for straight_line")
            amount = (depreciable / Decimal(life)).quantize(QUANT, rounding=ROUND_HALF_UP)
        elif method == "wdv":
            if life <= 0:
                raise InvalidAssetDepreciationState("useful_life_months is required for wdv")
            amount = (book / Decimal(life)).quantize(QUANT, rounding=ROUND_HALF_UP)
        elif method == "units_of_production":
            units = Decimal(str(row.units_produced or 0))
            total = Decimal(str(estimated_total_units or 0))
            if units <= ZERO or total <= ZERO:
                raise InvalidAssetDepreciationState(
                    "units_produced and estimated_total_units are required for units_of_production"
                )
            if units > total:
                raise InvalidAssetDepreciationState("units_produced cannot exceed estimated_total_units")
            amount = (depreciable * (units / total)).quantize(QUANT, rounding=ROUND_HALF_UP)
        else:
            raise InvalidAssetDepreciationState(f"Unsupported depreciation method: {method}")

        max_amount = book - salvage
        if max_amount < ZERO:
            max_amount = ZERO
        if amount > max_amount:
            amount = max_amount.quantize(QUANT, rounding=ROUND_HALF_UP)

        book_after = (book - amount).quantize(QUANT, rounding=ROUND_HALF_UP)
        if book_after < salvage:
            book_after = salvage.quantize(QUANT, rounding=ROUND_HALF_UP)
            amount = (book - book_after).quantize(QUANT, rounding=ROUND_HALF_UP)

        return DepreciationAmount(amount=amount, book_value_after=book_after)
