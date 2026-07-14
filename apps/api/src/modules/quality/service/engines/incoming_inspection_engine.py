"""Incoming inspection lifecycle engine."""

from datetime import datetime, timezone
from decimal import Decimal

from modules.quality.domain.entities import DispositionQty
from modules.quality.domain.enums import IncomingResult, IncomingStatus
from modules.quality.domain.exceptions import InvalidInspectionState
from modules.quality.models import QmIncomingInspection


class IncomingInspectionEngine:
    def validate_completable(self, inspection: QmIncomingInspection) -> None:
        if inspection.status not in {
            IncomingStatus.DRAFT.value,
            IncomingStatus.IN_PROGRESS.value,
        }:
            raise InvalidInspectionState("Inspection cannot be completed from current status")
        active_lines = [ln for ln in inspection.lines if not ln.is_deleted]
        if not active_lines:
            raise InvalidInspectionState("Inspection must have at least one line")
        disp = DispositionQty(
            inspected_qty=Decimal(str(inspection.inspected_qty)),
            accepted_qty=Decimal(str(inspection.accepted_qty)),
            rejected_qty=Decimal(str(inspection.rejected_qty)),
        )
        if not disp.validate():
            raise InvalidInspectionState("Invalid disposition quantities")

    def validate_approvable(self, inspection: QmIncomingInspection) -> None:
        if inspection.status != IncomingStatus.COMPLETED.value:
            raise InvalidInspectionState("Only completed inspections can be approved")
        if inspection.result == IncomingResult.PENDING.value:
            raise InvalidInspectionState("Inspection result must be set before approval")

    def apply_complete(self, inspection: QmIncomingInspection) -> None:
        self.validate_completable(inspection)
        inspection.status = IncomingStatus.COMPLETED.value
        inspection.inspected_at = datetime.now(timezone.utc)
        accepted = Decimal(str(inspection.accepted_qty))
        rejected = Decimal(str(inspection.rejected_qty))
        if rejected > 0 and accepted == 0:
            inspection.result = IncomingResult.REJECTED.value
        elif accepted > 0 and rejected == 0:
            inspection.result = IncomingResult.ACCEPTED.value
        elif accepted > 0 and rejected > 0:
            inspection.result = IncomingResult.CONDITIONAL.value
        else:
            inspection.result = IncomingResult.PENDING.value
