"""Asset lifecycle engine."""

from modules.asset.domain.enums import (
    AssetStatus,
)
from modules.asset.domain.exceptions import (
    InvalidAssetState,
)


class AssetEngine:
    def submit(self, row) -> None:
        if row.status != AssetStatus.DRAFT.value:
            raise InvalidAssetState("Only draft assets can be submitted")
        row.status = AssetStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != AssetStatus.SUBMITTED.value:
            raise InvalidAssetState("Only submitted assets can be approved")
        row.status = AssetStatus.APPROVED.value

    def activate(self, row) -> None:
        if row.status != AssetStatus.APPROVED.value:
            raise InvalidAssetState("Only approved assets can be activated")
        row.status = AssetStatus.ACTIVE.value

    def dispose(self, row, *, disposal_type: str | None = None) -> None:
        if row.status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value, AssetStatus.CANCELLED.value}:
            raise InvalidAssetState("Asset already terminal")
        if disposal_type == "write_off":
            row.status = AssetStatus.WRITTEN_OFF.value
        else:
            row.status = AssetStatus.DISPOSED.value

    def cancel(self, row) -> None:
        if row.status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value, AssetStatus.CANCELLED.value}:
            raise InvalidAssetState("Asset already terminal")
        row.status = AssetStatus.CANCELLED.value

    def reopen(self, row, *, workflow_status: str | None) -> None:
        if row.status != AssetStatus.CANCELLED.value:
            raise InvalidAssetState("Only cancelled registrations can be reopened")
        if workflow_status != "rejected":
            raise InvalidAssetState("Only rejected workflow registrations can be reopened")
        if row.master_asset_id is not None:
            raise InvalidAssetState("Cannot reopen after master asset was linked")
        row.status = AssetStatus.DRAFT.value

    def cancel_draft(self, row) -> None:
        if row.status != AssetStatus.DRAFT.value:
            raise InvalidAssetState("Only draft assets can be cancelled")
        row.status = AssetStatus.CANCELLED.value

