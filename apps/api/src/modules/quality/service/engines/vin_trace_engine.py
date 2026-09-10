"""VIN trace status engine."""

from modules.quality.domain.enums import VinTraceStatus
from modules.quality.domain.exceptions import InvalidVinTraceState
from modules.quality.models import QmVinTrace

_FORWARD = {
    VinTraceStatus.BUILT.value: {VinTraceStatus.INSPECTED.value},
    VinTraceStatus.INSPECTED.value: {VinTraceStatus.SHIPPED.value},
    VinTraceStatus.SHIPPED.value: set(),
}


class VinTraceEngine:
    def validate_status_change(self, trace: QmVinTrace, new_status: str) -> None:
        current = trace.status
        if new_status == current:
            return
        allowed = _FORWARD.get(current, set())
        if new_status not in allowed:
            raise InvalidVinTraceState(
                f"VIN trace cannot move from {current} to {new_status}"
            )

    def apply_status(self, trace: QmVinTrace, new_status: str) -> None:
        self.validate_status_change(trace, new_status)
        trace.status = new_status
