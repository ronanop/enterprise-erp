"""In-process inspection lifecycle engine."""

from modules.quality.domain.enums import InProcessResult, InProcessStatus
from modules.quality.domain.exceptions import InvalidInspectionState
from modules.quality.models import QmInprocessInspection


class InprocessInspectionEngine:
    def validate_completable(self, inspection: QmInprocessInspection) -> None:
        if inspection.status != InProcessStatus.DRAFT.value:
            raise InvalidInspectionState("Only draft inspections can be completed")
        if inspection.result == InProcessResult.PENDING.value:
            raise InvalidInspectionState("Result must be set before completion")

    def apply_complete(self, inspection: QmInprocessInspection) -> None:
        self.validate_completable(inspection)
        inspection.status = InProcessStatus.COMPLETED.value
