"""AssetLocation lifecycle engine (FP-ASSET-012)."""

from datetime import datetime

from modules.asset.domain.enums import AssetLocationStatus
from modules.asset.domain.exceptions import InvalidAssetLocationState


class AssetLocationEngine:
    def activate(self, row) -> None:
        row.status = AssetLocationStatus.ACTIVE.value
        row.is_current = True

    def mark_historical(self, row) -> None:
        """Used by transfer execution and supersede-on-create; no strict state guard."""
        row.status = AssetLocationStatus.HISTORICAL.value
        row.is_current = False

    def complete(self, row, *, effective_to: datetime | None = None) -> None:
        if row.status != AssetLocationStatus.ACTIVE.value:
            raise InvalidAssetLocationState("Only active locations can be completed")
        if not row.is_current:
            raise InvalidAssetLocationState("Only current locations can be completed")
        row.status = AssetLocationStatus.HISTORICAL.value
        row.is_current = False
        if effective_to is not None:
            row.effective_to = effective_to
