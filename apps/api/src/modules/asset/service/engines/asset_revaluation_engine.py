"""AssetRevaluation lifecycle engine (FP-ASSET-007)."""

from modules.asset.domain.enums import AssetRevaluationStatus
from modules.asset.domain.exceptions import InvalidAssetRevaluationState
from modules.foundation.domain.enums import WorkflowStatus


class AssetRevaluationEngine:
    def submit(self, row) -> None:
        if row.status != AssetRevaluationStatus.DRAFT.value:
            raise InvalidAssetRevaluationState("Only draft revaluations can be submitted")
        row.status = AssetRevaluationStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != AssetRevaluationStatus.SUBMITTED.value:
            raise InvalidAssetRevaluationState("Only submitted revaluations can be approved")
        row.status = AssetRevaluationStatus.APPROVED.value

    def post(self, row) -> None:
        if row.status != AssetRevaluationStatus.APPROVED.value:
            raise InvalidAssetRevaluationState("Only approved revaluations can be posted")
        row.status = AssetRevaluationStatus.POSTED.value

    def cancel_draft(self, row) -> None:
        if row.status != AssetRevaluationStatus.DRAFT.value:
            raise InvalidAssetRevaluationState("Only draft revaluations can be cancelled")
        row.status = AssetRevaluationStatus.CANCELLED.value

    def reopen(self, row, *, workflow_status: str | None) -> None:
        if row.status != AssetRevaluationStatus.CANCELLED.value:
            raise InvalidAssetRevaluationState("Only cancelled revaluations can be reopened")
        if workflow_status != WorkflowStatus.REJECTED.value:
            raise InvalidAssetRevaluationState(
                "Only rejected workflow revaluations can be reopened"
            )
        row.status = AssetRevaluationStatus.DRAFT.value
