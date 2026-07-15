"""Audit lifecycle engine."""

from modules.grc.domain.enums import (
    AuditStatus,
)
from modules.grc.domain.exceptions import (
    InvalidAuditState,
)


class AuditEngine:
    def submit(self, row) -> None:
        if row.status != AuditStatus.DRAFT.value:
            raise InvalidAuditState("Only draft audits can be submitted")
        row.status = AuditStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != AuditStatus.SUBMITTED.value:
            raise InvalidAuditState("Only submitted audits can be approved")
        row.status = AuditStatus.APPROVED.value

    def plan(self, row) -> None:
        row.status = AuditStatus.PLANNED.value

    def start(self, row) -> None:
        row.status = AuditStatus.IN_PROGRESS.value

    def complete(self, row) -> None:
        row.status = AuditStatus.COMPLETED.value

    def close(self, row) -> None:
        row.status = AuditStatus.CLOSED.value

    def cancel(self, row) -> None:
        row.status = AuditStatus.CANCELLED.value

