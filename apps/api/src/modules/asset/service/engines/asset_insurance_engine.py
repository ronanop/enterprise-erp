"""AssetInsurance lifecycle engine (FP-ASSET-010)."""

from modules.asset.domain.enums import AssetInsuranceStatus
from modules.asset.domain.exceptions import InvalidAssetInsuranceState


class AssetInsuranceEngine:
    def activate(self, row) -> None:
        if row.status != AssetInsuranceStatus.DRAFT.value:
            raise InvalidAssetInsuranceState("Only draft insurance policies can be activated")
        row.status = AssetInsuranceStatus.ACTIVE.value

    def renew(self, row) -> None:
        if row.status != AssetInsuranceStatus.ACTIVE.value:
            raise InvalidAssetInsuranceState("Only active insurance policies can be renewed")
        row.status = AssetInsuranceStatus.RENEWED.value

    def expire(self, row) -> None:
        if row.status not in {
            AssetInsuranceStatus.ACTIVE.value,
            AssetInsuranceStatus.RENEWED.value,
        }:
            raise InvalidAssetInsuranceState(
                "Only active or renewed insurance policies can be expired"
            )
        row.status = AssetInsuranceStatus.EXPIRED.value

    def close(self, row) -> None:
        if row.status != AssetInsuranceStatus.EXPIRED.value:
            raise InvalidAssetInsuranceState("Only expired insurance policies can be closed")
        row.status = AssetInsuranceStatus.CANCELLED.value

    def cancel(self, row) -> None:
        """ERD-compatible cancel; not used by productized close API."""
        if row.status == AssetInsuranceStatus.CANCELLED.value:
            raise InvalidAssetInsuranceState("Insurance policy is already cancelled")
        row.status = AssetInsuranceStatus.CANCELLED.value
