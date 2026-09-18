
"""Recruitment domain enums per ERD_13 §11."""

from enum import Enum


class ActiveInactive(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class JobRequisitionStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    OPEN = "open"
    ON_HOLD = "on_hold"
    FILLED = "filled"
    CLOSED = "closed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class JobPostingStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    PAUSED = "paused"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class CandidateStatus(str, Enum):
    PROSPECT = "prospect"
    APPLIED = "applied"
    SCREENING = "screening"
    INTERVIEW = "interview"
    SELECTED = "selected"
    OFFERED = "offered"
    HIRED = "hired"
    REJECTED = "rejected"
    ON_HOLD = "on_hold"
    WITHDRAWN = "withdrawn"
    BLACKLISTED = "blacklisted"


class CandidateDocumentStatus(str, Enum):
    UPLOADED = "uploaded"
    VERIFIED = "verified"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class ResumeStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    ARCHIVED = "archived"


class ApplicationStatus(str, Enum):
    """Outcome / activity — independent of pipeline stage (kanban column)."""

    ACTIVE = "active"
    REJECTED = "rejected"
    OFFER_DECLINED = "offer_declined"
    BACKED_OUT = "backed_out"
    HIRED = "hired"


class ApplicationPipelineStage(str, Enum):
    """Kanban column — preserved after exit for conversion metrics."""

    SOURCED = "sourced"
    SCREENING = "screening"
    INTERVIEW_ROUND_1 = "interview_round_1"
    INTERVIEW_ROUND_2 = "interview_round_2"
    HR_DISCUSSION = "hr_discussion"
    BACKGROUND_CHECK = "background_check"
    OFFER_SENT = "offer_sent"
    OFFER_ACCEPTED = "offer_accepted"


class ApplicationStageStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class InterviewStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class InterviewFeedbackStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    LOCKED = "locked"


class OfferStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    WITHDRAWN = "withdrawn"
    CANCELLED = "cancelled"


class OfferApprovalStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class BackgroundVerificationStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    IN_PROGRESS = "in_progress"
    CLEARED = "cleared"
    FAILED = "failed"
    WAIVED = "waived"
    CANCELLED = "cancelled"


class ReferenceCheckStatus(str, Enum):
    PENDING = "pending"
    CONTACTED = "contacted"
    COMPLETED = "completed"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class TalentPoolStatus(str, Enum):
    ACTIVE = "active"
    REMOVED = "removed"
    HIRED_OUT = "hired_out"


class CandidateNoteStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class OnboardingStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class OnboardingTaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    WAIVED = "waived"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class RecruitmentReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class PayrollHandoffStatus(str, Enum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class RecEntityType(str, Enum):
    JOB_REQUISITION = "job_requisition"
    JOB_POSTING = "job_posting"
    CANDIDATE = "candidate"
    APPLICATION = "application"
    INTERVIEW = "interview"
    OFFER = "offer"
    BACKGROUND_VERIFICATION = "background_verification"
    ONBOARDING = "onboarding"
    RECRUITER = "recruiter"
    RECRUITMENT_SOURCE = "recruitment_source"
    TALENT_POOL = "talent_pool"
    RECRUITMENT_REPORT = "recruitment_report"


CODE_PREFIXES: dict[RecEntityType, tuple[str, int, bool]] = {
    RecEntityType.JOB_REQUISITION: ("REQ-", 6, True),
    RecEntityType.JOB_POSTING: ("POST-", 6, True),
    RecEntityType.CANDIDATE: ("CAN-", 6, False),
    RecEntityType.APPLICATION: ("APP-", 6, True),
    RecEntityType.INTERVIEW: ("INTV-", 6, True),
    RecEntityType.OFFER: ("OFF-", 6, True),
    RecEntityType.BACKGROUND_VERIFICATION: ("BGV-", 6, True),
    RecEntityType.ONBOARDING: ("ONB-", 6, True),
    RecEntityType.RECRUITER: ("RCR-", 6, False),
    RecEntityType.RECRUITMENT_SOURCE: ("SRC-", 6, False),
    RecEntityType.TALENT_POOL: ("POOL-", 6, False),
    RecEntityType.RECRUITMENT_REPORT: ("RPT-", 6, True),
}
