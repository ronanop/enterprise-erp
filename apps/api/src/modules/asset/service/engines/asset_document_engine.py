"""AssetDocument lifecycle engine (FP-ASSET-016)."""

from modules.asset.domain.enums import AssetDocumentStatus
from modules.asset.domain.exceptions import InvalidAssetDocumentState


class AssetDocumentEngine:
    def supersede(self, row) -> None:
        if row.status != AssetDocumentStatus.ACTIVE.value:
            raise InvalidAssetDocumentState("Only active documents can be superseded")
        row.status = AssetDocumentStatus.SUPERSEDED.value

    def archive(self, row) -> None:
        if row.status not in {
            AssetDocumentStatus.ACTIVE.value,
            AssetDocumentStatus.SUPERSEDED.value,
        }:
            raise InvalidAssetDocumentState("Only active or superseded documents can be archived")
        row.status = AssetDocumentStatus.ARCHIVED.value
