"""AuditFinding lifecycle engine."""

from modules.grc.domain.enums import (
    AuditFindingStatus,
)


class AuditFindingEngine:
    def remediate(self, row) -> None:
        row.status = AuditFindingStatus.IN_REMEDIATION.value

    def close(self, row) -> None:
        row.status = AuditFindingStatus.CLOSED.value

    def accept(self, row) -> None:
        row.status = AuditFindingStatus.ACCEPTED.value

