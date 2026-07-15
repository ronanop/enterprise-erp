"""PolicyAcknowledgement lifecycle engine."""

from modules.grc.domain.enums import (
    PolicyAcknowledgementStatus,
)


class PolicyAcknowledgementEngine:
    def acknowledge(self, row) -> None:
        row.status = PolicyAcknowledgementStatus.ACKNOWLEDGED.value

    def mark_overdue(self, row) -> None:
        row.status = PolicyAcknowledgementStatus.OVERDUE.value

    def waive(self, row) -> None:
        row.status = PolicyAcknowledgementStatus.WAIVED.value

