"""Application lifecycle engine — stage (kanban) independent of status."""

from datetime import datetime, timezone

from modules.recruitment.domain.enums import ApplicationPipelineStage, ApplicationStatus
from modules.recruitment.domain.exceptions import InvalidApplicationState

PIPELINE_ORDER: list[str] = [s.value for s in ApplicationPipelineStage]

LEGACY_STAGE_ALIASES: dict[str, str] = {
    "applied": ApplicationPipelineStage.SOURCED.value,
    "resume_screening": ApplicationPipelineStage.SCREENING.value,
    "hr_screening": ApplicationPipelineStage.SCREENING.value,
    "technical_interview": ApplicationPipelineStage.INTERVIEW_ROUND_1.value,
    "interview": ApplicationPipelineStage.INTERVIEW_ROUND_1.value,
    "manager_interview": ApplicationPipelineStage.INTERVIEW_ROUND_2.value,
    "final_interview": ApplicationPipelineStage.HR_DISCUSSION.value,
    "selected": ApplicationPipelineStage.HR_DISCUSSION.value,
    "offer": ApplicationPipelineStage.OFFER_SENT.value,
    "hired": ApplicationPipelineStage.OFFER_ACCEPTED.value,
}


def normalize_stage(stage: str) -> str:
    key = (stage or "").strip().lower()
    return LEGACY_STAGE_ALIASES.get(key, key)


def next_stage(stage: str) -> str | None:
    stage = normalize_stage(stage)
    try:
        idx = PIPELINE_ORDER.index(stage)
    except ValueError:
        return None
    if idx >= len(PIPELINE_ORDER) - 1:
        return None
    return PIPELINE_ORDER[idx + 1]


def can_advance(stage: str, status: str) -> bool:
    return status == ApplicationStatus.ACTIVE.value and next_stage(stage) is not None


def can_mark_hired(stage: str, status: str) -> bool:
    return (
        status == ApplicationStatus.ACTIVE.value
        and normalize_stage(stage) == ApplicationPipelineStage.OFFER_ACCEPTED.value
    )


def can_mark_backed_out(stage: str, status: str) -> bool:
    return can_mark_hired(stage, status)


class ApplicationEngine:
    def advance(self, row, *, stage: str) -> None:
        if getattr(row, "status", None) not in (None, ApplicationStatus.ACTIVE.value):
            if row.status not in {
                ApplicationStatus.ACTIVE.value,
                "applied",
                "screening",
                "interview",
                "selected",
                "offer",
                "on_hold",
            }:
                raise InvalidApplicationState("Only active applications can advance")

        target = normalize_stage(stage)
        if target not in PIPELINE_ORDER:
            raise InvalidApplicationState(f"Invalid application stage '{stage}'")

        current = normalize_stage(
            row.current_stage_code or ApplicationPipelineStage.SOURCED.value
        )
        if target == current:
            return

        row.current_stage_code = target
        if row.status in {
            None,
            "applied",
            "screening",
            "interview",
            "selected",
            "offer",
            "on_hold",
        }:
            row.status = ApplicationStatus.ACTIVE.value
        elif not row.status:
            row.status = ApplicationStatus.ACTIVE.value

    def reject(self, row, *, reason: str | None = None) -> None:
        cleaned = (reason or "").strip()
        if not cleaned:
            raise InvalidApplicationState("exit_reason is required when rejecting")
        stage = normalize_stage(
            row.current_stage_code or ApplicationPipelineStage.SOURCED.value
        )
        row.status = ApplicationStatus.REJECTED.value
        row.exited_at_stage = stage
        row.exited_at = datetime.now(timezone.utc)
        row.exit_reason = cleaned
        row.rejection_reason = cleaned

    def mark_backed_out(self, row, *, reason: str | None = None) -> None:
        stage = normalize_stage(row.current_stage_code or "")
        status = row.status or ApplicationStatus.ACTIVE.value
        if not can_mark_backed_out(stage, status):
            raise InvalidApplicationState(
                "backed_out is only allowed when stage is offer_accepted and status is active"
            )
        cleaned = (reason or "").strip()
        if not cleaned:
            raise InvalidApplicationState("exit_reason is required when marking backed out")
        row.status = ApplicationStatus.BACKED_OUT.value
        row.exited_at_stage = ApplicationPipelineStage.OFFER_ACCEPTED.value
        row.exited_at = datetime.now(timezone.utc)
        row.exit_reason = cleaned
        row.rejection_reason = cleaned

    def mark_hired(self, row) -> None:
        stage = normalize_stage(row.current_stage_code or "")
        status = row.status or ApplicationStatus.ACTIVE.value
        if not can_mark_hired(stage, status):
            raise InvalidApplicationState(
                "hired is only allowed when stage is offer_accepted and status is active"
            )
        row.status = ApplicationStatus.HIRED.value
        row.exited_at_stage = ApplicationPipelineStage.OFFER_ACCEPTED.value
        row.exited_at = datetime.now(timezone.utc)

    def mark_offer_declined(self, row, *, reason: str | None = None) -> None:
        cleaned = (reason or "").strip()
        if not cleaned:
            raise InvalidApplicationState("exit_reason is required when declining an offer")
        stage = normalize_stage(
            row.current_stage_code or ApplicationPipelineStage.OFFER_SENT.value
        )
        row.status = ApplicationStatus.OFFER_DECLINED.value
        row.exited_at_stage = stage
        row.exited_at = datetime.now(timezone.utc)
        row.exit_reason = cleaned
        row.rejection_reason = cleaned

    def hold(self, row) -> None:
        row.status = ApplicationStatus.ACTIVE.value

    def withdraw(self, row, *, reason: str | None = None) -> None:
        self.mark_backed_out(row, reason=reason or "Withdrawn")
