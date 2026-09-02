"""AssetWarranty lifecycle engine (FP-ASSET-009)."""

from modules.asset.domain.enums import AssetWarrantyStatus
from modules.asset.domain.exceptions import InvalidAssetWarrantyState


class AssetWarrantyEngine:
    def activate(self, row) -> None:
        if row.status != AssetWarrantyStatus.DRAFT.value:
            raise InvalidAssetWarrantyState("Only draft warranties can be activated")
        row.status = AssetWarrantyStatus.ACTIVE.value

    def extend(self, row) -> None:
        if row.status != AssetWarrantyStatus.ACTIVE.value:
            raise InvalidAssetWarrantyState("Only active warranties can be extended")
        row.status = AssetWarrantyStatus.EXTENDED.value

    def expire(self, row) -> None:
        if row.status not in {
            AssetWarrantyStatus.ACTIVE.value,
            AssetWarrantyStatus.EXTENDED.value,
        }:
            raise InvalidAssetWarrantyState("Only active or extended warranties can be expired")
        row.status = AssetWarrantyStatus.EXPIRED.value

    def void(self, row) -> None:
        """ERD-compatible void; not used by productized activate/extend/expire APIs."""
        if row.status == AssetWarrantyStatus.EXPIRED.value:
            raise InvalidAssetWarrantyState("Expired warranties cannot be voided")
        if row.status == AssetWarrantyStatus.VOID.value:
            raise InvalidAssetWarrantyState("Warranty is already void")
        row.status = AssetWarrantyStatus.VOID.value
