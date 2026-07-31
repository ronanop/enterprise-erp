"""AssetServiceHistory lifecycle engine (FP-ASSET-013)."""

from modules.asset.domain.enums import AssetServiceHistoryStatus


class AssetServiceHistoryEngine:
    def record(self, row) -> None:
        row.status = AssetServiceHistoryStatus.RECORDED.value
