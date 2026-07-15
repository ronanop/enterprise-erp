"""AuditPlan lifecycle engine."""

from modules.grc.domain.enums import (
    AuditPlanStatus,
)


class AuditPlanEngine:
    def approve(self, row) -> None:
        row.status = AuditPlanStatus.APPROVED.value

    def activate(self, row) -> None:
        row.status = AuditPlanStatus.ACTIVE.value

    def close(self, row) -> None:
        row.status = AuditPlanStatus.CLOSED.value

