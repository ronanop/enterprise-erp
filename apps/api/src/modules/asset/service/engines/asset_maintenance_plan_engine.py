"""AssetMaintenancePlan lifecycle engine (FP-ASSET-011)."""

from modules.asset.domain.enums import AssetMaintenancePlanStatus
from modules.asset.domain.exceptions import InvalidAssetMaintenancePlanState


class AssetMaintenancePlanEngine:
    def activate(self, row) -> None:
        if row.status != AssetMaintenancePlanStatus.DRAFT.value:
            raise InvalidAssetMaintenancePlanState("Only draft plans can be activated")
        row.status = AssetMaintenancePlanStatus.ACTIVE.value

    def pause(self, row) -> None:
        if row.status != AssetMaintenancePlanStatus.ACTIVE.value:
            raise InvalidAssetMaintenancePlanState("Only active plans can be paused")
        row.status = AssetMaintenancePlanStatus.PAUSED.value

    def resume(self, row) -> None:
        if row.status != AssetMaintenancePlanStatus.PAUSED.value:
            raise InvalidAssetMaintenancePlanState("Only paused plans can be resumed")
        row.status = AssetMaintenancePlanStatus.ACTIVE.value

    def close(self, row) -> None:
        if row.status not in {
            AssetMaintenancePlanStatus.ACTIVE.value,
            AssetMaintenancePlanStatus.PAUSED.value,
        }:
            raise InvalidAssetMaintenancePlanState(
                "Only active or paused plans can be closed"
            )
        row.status = AssetMaintenancePlanStatus.CLOSED.value
