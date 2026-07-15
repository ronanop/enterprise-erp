"""RiskAssessment lifecycle engine."""

from modules.grc.domain.enums import (
    RiskAssessmentStatus,
)


class RiskAssessmentEngine:
    def complete(self, row) -> None:
        row.status = RiskAssessmentStatus.COMPLETED.value

    def archive(self, row) -> None:
        row.status = RiskAssessmentStatus.ARCHIVED.value

