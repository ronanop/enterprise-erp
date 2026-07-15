"""Incident lifecycle engine."""

from modules.grc.domain.enums import (
    IncidentStatus,
)
from modules.grc.domain.exceptions import (
    InvalidIncidentState,
)


class IncidentEngine:
    def submit(self, row) -> None:
        if row.status != IncidentStatus.DRAFT.value:
            raise InvalidIncidentState("Only draft incidents can be submitted")
        row.status = IncidentStatus.SUBMITTED.value

    def review(self, row) -> None:
        if row.status != IncidentStatus.SUBMITTED.value:
            raise InvalidIncidentState("Only submitted incidents can be reviewed")
        row.status = IncidentStatus.UNDER_REVIEW.value

    def open(self, row) -> None:
        row.status = IncidentStatus.OPEN.value

    def contain(self, row) -> None:
        row.status = IncidentStatus.CONTAINED.value

    def resolve(self, row) -> None:
        row.status = IncidentStatus.RESOLVED.value

    def close(self, row) -> None:
        if row.status not in {
            IncidentStatus.UNDER_REVIEW.value,
            IncidentStatus.OPEN.value,
            IncidentStatus.CONTAINED.value,
            IncidentStatus.RESOLVED.value,
        }:
            raise InvalidIncidentState("Incident not closable")
        row.status = IncidentStatus.CLOSED.value

    def cancel(self, row) -> None:
        row.status = IncidentStatus.CANCELLED.value

