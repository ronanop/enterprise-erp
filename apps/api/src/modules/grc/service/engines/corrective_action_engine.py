"""CorrectiveAction lifecycle engine."""

from modules.grc.domain.enums import (
    CorrectiveActionStatus,
)
from modules.grc.domain.exceptions import (
    InvalidCorrectiveActionState,
)


class CorrectiveActionEngine:
    def submit(self, row) -> None:
        if row.status != CorrectiveActionStatus.DRAFT.value:
            raise InvalidCorrectiveActionState("Only draft CAPAs can be submitted")
        row.status = CorrectiveActionStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != CorrectiveActionStatus.SUBMITTED.value:
            raise InvalidCorrectiveActionState("Only submitted CAPAs can be approved")
        row.status = CorrectiveActionStatus.APPROVED.value

    def open(self, row) -> None:
        row.status = CorrectiveActionStatus.OPEN.value

    def start(self, row) -> None:
        row.status = CorrectiveActionStatus.IN_PROGRESS.value

    def complete(self, row) -> None:
        if row.status not in {
            CorrectiveActionStatus.APPROVED.value,
            CorrectiveActionStatus.OPEN.value,
            CorrectiveActionStatus.IN_PROGRESS.value,
        }:
            raise InvalidCorrectiveActionState("CAPA not completable")
        row.status = CorrectiveActionStatus.COMPLETED.value

    def verify(self, row) -> None:
        row.status = CorrectiveActionStatus.VERIFIED.value

    def cancel(self, row) -> None:
        row.status = CorrectiveActionStatus.CANCELLED.value

