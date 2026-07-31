"""Application lifecycle engine."""

from modules.recruitment.domain.enums import (
    ApplicationStatus,
)
from modules.recruitment.domain.exceptions import (
    InvalidApplicationState,
)


class ApplicationEngine:
    def advance(self, row, *, stage: str) -> None:
        # ATS may jump across UI stages; map onto API pipeline statuses.
        aliases = {
            "resume_screening": "screening",
            "hr_screening": "screening",
            "technical_interview": "interview",
            "manager_interview": "interview",
            "final_interview": "interview",
            "selected": "selected",
        }
        stage = aliases.get(stage, stage)
        allowed = {
            ApplicationStatus.APPLIED.value,
            ApplicationStatus.SCREENING.value,
            ApplicationStatus.INTERVIEW.value,
            ApplicationStatus.SELECTED.value,
            ApplicationStatus.OFFER.value,
            ApplicationStatus.HIRED.value,
        }
        if stage not in allowed:
            raise InvalidApplicationState(f"Invalid application stage '{stage}'")
        row.status = stage
        row.current_stage_code = stage

    def reject(self, row, *, reason: str | None = None) -> None:
        row.status = ApplicationStatus.REJECTED.value
        row.rejection_reason = reason

    def hold(self, row) -> None:
        row.status = ApplicationStatus.ON_HOLD.value

    def withdraw(self, row) -> None:
        row.status = ApplicationStatus.WITHDRAWN.value

