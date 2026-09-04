"""AssetChecklist lifecycle engine (FP-ASSET-014)."""

from datetime import datetime

from modules.asset.domain.enums import AssetChecklistStatus
from modules.asset.domain.exceptions import InvalidAssetChecklistState


class AssetChecklistEngine:
    def complete(self, row, *, completed_at: datetime) -> None:
        if row.status != AssetChecklistStatus.DRAFT.value:
            raise InvalidAssetChecklistState("Only draft checklists can be completed")
        row.status = AssetChecklistStatus.COMPLETED.value
        row.completed_at = completed_at

    def cancel(self, row) -> None:
        if row.status != AssetChecklistStatus.DRAFT.value:
            raise InvalidAssetChecklistState("Only draft checklists can be cancelled")
        row.status = AssetChecklistStatus.CANCELLED.value
