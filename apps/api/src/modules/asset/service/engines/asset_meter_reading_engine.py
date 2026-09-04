"""AssetMeterReading lifecycle engine (FP-ASSET-015)."""

from modules.asset.domain.enums import AssetMeterReadingStatus
from modules.asset.domain.exceptions import InvalidAssetMeterReadingState


class AssetMeterReadingEngine:
    def void(self, row) -> None:
        if row.status != AssetMeterReadingStatus.RECORDED.value:
            raise InvalidAssetMeterReadingState("Only recorded meter readings can be voided")
        row.status = AssetMeterReadingStatus.VOID.value
