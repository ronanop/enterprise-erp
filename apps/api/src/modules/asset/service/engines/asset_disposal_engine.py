"""AssetDisposal lifecycle engine (FP-ASSET-005)."""

from modules.asset.domain.enums import AssetDisposalStatus
from modules.asset.domain.exceptions import InvalidAssetDisposalState
from modules.foundation.domain.enums import WorkflowStatus


class AssetDisposalEngine:
    def submit(self, row) -> None:
        if row.status != AssetDisposalStatus.DRAFT.value:
            raise InvalidAssetDisposalState("Only draft disposals can be submitted")
        row.status = AssetDisposalStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != AssetDisposalStatus.SUBMITTED.value:
            raise InvalidAssetDisposalState("Only submitted disposals can be approved")
        row.status = AssetDisposalStatus.APPROVED.value

    def post(self, row) -> None:
        if row.status != AssetDisposalStatus.APPROVED.value:
            raise InvalidAssetDisposalState("Only approved disposals can be posted")
        row.status = AssetDisposalStatus.POSTED.value

    def cancel_draft(self, row) -> None:
        if row.status != AssetDisposalStatus.DRAFT.value:
            raise InvalidAssetDisposalState("Only draft disposals can be cancelled")
        row.status = AssetDisposalStatus.CANCELLED.value

    def reopen(self, row, *, workflow_status: str | None) -> None:
        if row.status != AssetDisposalStatus.CANCELLED.value:
            raise InvalidAssetDisposalState("Only cancelled disposals can be reopened")
        if workflow_status != WorkflowStatus.REJECTED.value:
            raise InvalidAssetDisposalState("Only rejected workflow disposals can be reopened")
        row.status = AssetDisposalStatus.DRAFT.value
