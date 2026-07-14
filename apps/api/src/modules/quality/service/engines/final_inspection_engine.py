"""Final inspection lifecycle engine."""

from decimal import Decimal

from modules.quality.domain.enums import FinalResult, FinalStatus
from modules.quality.domain.exceptions import InvalidInspectionState
from modules.quality.models import QmFinalInspection


class FinalInspectionEngine:
    def validate_submittable(self, inspection: QmFinalInspection) -> None:
        if inspection.status != FinalStatus.DRAFT.value:
            raise InvalidInspectionState("Only draft inspections can be submitted")
        if Decimal(str(inspection.inspected_qty)) <= 0:
            raise InvalidInspectionState("Inspected quantity must be positive")

    def validate_approvable(self, inspection: QmFinalInspection) -> None:
        if inspection.status != FinalStatus.SUBMITTED.value:
            raise InvalidInspectionState("Only submitted inspections can be approved")
        if inspection.result == FinalResult.PENDING.value:
            raise InvalidInspectionState("Result must be set before approval")

    def validate_completable(self, inspection: QmFinalInspection) -> None:
        if inspection.status != FinalStatus.APPROVED.value:
            raise InvalidInspectionState("Only approved inspections can be completed")

    def apply_submit(self, inspection: QmFinalInspection) -> None:
        self.validate_submittable(inspection)
        inspection.status = FinalStatus.SUBMITTED.value

    def apply_approve(self, inspection: QmFinalInspection) -> None:
        self.validate_approvable(inspection)
        inspection.status = FinalStatus.APPROVED.value

    def apply_complete(self, inspection: QmFinalInspection) -> None:
        self.validate_completable(inspection)
        inspection.status = FinalStatus.COMPLETED.value
