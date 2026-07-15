"""Exception lifecycle engine."""

from modules.grc.domain.enums import (
    ExceptionStatus,
)
from modules.grc.domain.exceptions import (
    InvalidExceptionState,
)


class ExceptionEngine:
    def open(self, row) -> None:
        row.status = ExceptionStatus.OPEN.value

    def investigate(self, row) -> None:
        row.status = ExceptionStatus.UNDER_INVESTIGATION.value

    def approve(self, row) -> None:
        if row.status not in {
            ExceptionStatus.DRAFT.value,
            ExceptionStatus.OPEN.value,
            ExceptionStatus.UNDER_INVESTIGATION.value,
        }:
            raise InvalidExceptionState("Exception not approvable")
        row.status = ExceptionStatus.APPROVED.value

    def reject(self, row) -> None:
        row.status = ExceptionStatus.REJECTED.value

    def close(self, row) -> None:
        row.status = ExceptionStatus.CLOSED.value

    def expire(self, row) -> None:
        row.status = ExceptionStatus.EXPIRED.value

