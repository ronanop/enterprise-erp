"""Recall campaign lifecycle — independent of CAPA action-plan status."""

from modules.quality.domain.enums import RecallStatus
from modules.quality.domain.exceptions import InvalidRecallState
from modules.quality.models import QmRecall

_CLOSEABLE = {
    RecallStatus.ANNOUNCED.value,
    RecallStatus.IN_PROGRESS.value,
}


class RecallEngine:
    def validate_announceable(self, recall: QmRecall) -> None:
        if recall.status != RecallStatus.DRAFT.value:
            raise InvalidRecallState("Only draft recalls can be announced")
        if not (recall.product_id and str(recall.trigger_reason or "").strip()):
            raise InvalidRecallState("Product and trigger reason are required to announce a recall")

    def validate_closable(self, recall: QmRecall) -> None:
        if recall.status not in _CLOSEABLE:
            raise InvalidRecallState("Recall cannot be closed from current status")

    def apply_announce(self, recall: QmRecall) -> None:
        self.validate_announceable(recall)
        recall.status = RecallStatus.ANNOUNCED.value

    def apply_close(self, recall: QmRecall) -> None:
        self.validate_closable(recall)
        recall.status = RecallStatus.CLOSED.value

    def apply_status(self, recall: QmRecall, new_status: str) -> None:
        target = new_status.strip().lower()
        if target == RecallStatus.CANCELLED.value:
            if recall.status != RecallStatus.DRAFT.value:
                raise InvalidRecallState("Only draft recalls can be cancelled")
            recall.status = RecallStatus.CANCELLED.value
            return
        if target == RecallStatus.IN_PROGRESS.value:
            if recall.status != RecallStatus.ANNOUNCED.value:
                raise InvalidRecallState("Only announced recalls can move to in progress")
            recall.status = RecallStatus.IN_PROGRESS.value
            return
        raise InvalidRecallState("Status can only be patched to in_progress or cancelled")
