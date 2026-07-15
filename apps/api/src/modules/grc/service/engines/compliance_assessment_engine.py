"""ComplianceAssessment lifecycle engine."""

from modules.grc.domain.enums import (
    ComplianceAssessmentStatus,
)


class ComplianceAssessmentEngine:
    def complete(self, row) -> None:
        row.status = ComplianceAssessmentStatus.COMPLETED.value

    def mark_overdue(self, row) -> None:
        row.status = ComplianceAssessmentStatus.OVERDUE.value

    def archive(self, row) -> None:
        row.status = ComplianceAssessmentStatus.ARCHIVED.value

