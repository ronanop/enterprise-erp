"""AssetComponent lifecycle engine (FP-ASSET-019).

No persistence. No HTTP.
"""

from modules.asset.domain.enums import AssetComponentStatus
from modules.asset.domain.exceptions import InvalidAssetComponentState


class AssetComponentEngine:
    def install_defaults(self, row) -> None:
        row.status = AssetComponentStatus.ACTIVE.value

    def replace(self, row) -> None:
        if row.status != AssetComponentStatus.ACTIVE.value:
            raise InvalidAssetComponentState("Only active components can be replaced")
        row.status = AssetComponentStatus.REPLACED.value

    def dispose(self, row) -> None:
        if row.status != AssetComponentStatus.ACTIVE.value:
            raise InvalidAssetComponentState("Only active components can be disposed")
        row.status = AssetComponentStatus.DISPOSED.value
