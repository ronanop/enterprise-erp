"""RiskTreatment lifecycle engine."""

from modules.grc.domain.enums import (
    RiskTreatmentStatus,
)


class RiskTreatmentEngine:
    def plan(self, row) -> None:
        row.status = RiskTreatmentStatus.PLANNED.value

    def start(self, row) -> None:
        row.status = RiskTreatmentStatus.IN_PROGRESS.value

    def complete(self, row) -> None:
        row.status = RiskTreatmentStatus.COMPLETED.value

    def defer(self, row) -> None:
        row.status = RiskTreatmentStatus.DEFERRED.value

    def cancel(self, row) -> None:
        row.status = RiskTreatmentStatus.CANCELLED.value

