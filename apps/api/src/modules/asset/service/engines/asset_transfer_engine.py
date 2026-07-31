"""AssetTransfer lifecycle engine."""

from modules.asset.domain.enums import (
    AssetTransferStatus,
)
from modules.asset.domain.exceptions import (
    InvalidAssetTransferState,
)


class AssetTransferEngine:
    def submit(self, row) -> None:
        if row.status != AssetTransferStatus.DRAFT.value:
            raise InvalidAssetTransferState("Only draft transfers can be submitted")
        row.status = AssetTransferStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != AssetTransferStatus.SUBMITTED.value:
            raise InvalidAssetTransferState("Only submitted transfers can be approved")
        row.status = AssetTransferStatus.APPROVED.value

    def execute(self, row) -> None:
        if row.status != AssetTransferStatus.APPROVED.value:
            raise InvalidAssetTransferState("Only approved transfers can be executed")
        row.status = AssetTransferStatus.COMPLETED.value

    def cancel_draft(self, row) -> None:
        if row.status != AssetTransferStatus.DRAFT.value:
            raise InvalidAssetTransferState("Only draft transfers can be cancelled")
        row.status = AssetTransferStatus.CANCELLED.value

    def reopen(self, row, *, workflow_status: str | None) -> None:
        if row.status != AssetTransferStatus.CANCELLED.value:
            raise InvalidAssetTransferState("Only cancelled transfers can be reopened")
        if workflow_status != "rejected":
            raise InvalidAssetTransferState("Only rejected workflow transfers can be reopened")
        row.status = AssetTransferStatus.DRAFT.value

