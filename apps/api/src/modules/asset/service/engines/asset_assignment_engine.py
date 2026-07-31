"""AssetAssignment lifecycle engine."""

from modules.asset.domain.enums import (
    AssetAssignmentStatus,
)
from modules.asset.domain.exceptions import (
    InvalidAssetAssignmentState,
)


class AssetAssignmentEngine:
    def submit(self, row) -> None:
        if row.status != AssetAssignmentStatus.DRAFT.value:
            raise InvalidAssetAssignmentState("Only draft assignments can be submitted")
        row.status = AssetAssignmentStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != AssetAssignmentStatus.SUBMITTED.value:
            raise InvalidAssetAssignmentState("Only submitted assignments can be approved")
        row.status = AssetAssignmentStatus.APPROVED.value

    def activate(self, row) -> None:
        if row.status != AssetAssignmentStatus.APPROVED.value:
            raise InvalidAssetAssignmentState("Only approved assignments can be activated")
        row.status = AssetAssignmentStatus.ACTIVE.value

    def return_assignment(self, row) -> None:
        if row.status != AssetAssignmentStatus.ACTIVE.value:
            raise InvalidAssetAssignmentState("Only active assignments can be returned")
        row.status = AssetAssignmentStatus.RETURNED.value

    def cancel_draft(self, row) -> None:
        if row.status != AssetAssignmentStatus.DRAFT.value:
            raise InvalidAssetAssignmentState("Only draft assignments can be cancelled")
        row.status = AssetAssignmentStatus.CANCELLED.value

    def reopen(self, row, *, workflow_status: str | None) -> None:
        if row.status != AssetAssignmentStatus.CANCELLED.value:
            raise InvalidAssetAssignmentState("Only cancelled assignments can be reopened")
        if workflow_status != "rejected":
            raise InvalidAssetAssignmentState("Only rejected workflow assignments can be reopened")
        row.status = AssetAssignmentStatus.DRAFT.value
