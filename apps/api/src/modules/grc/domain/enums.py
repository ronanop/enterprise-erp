"""GRC domain enums per ERD_19 section 11."""

from enum import Enum


class PolicyStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    SUPERSEDED = "superseded"
    RETIRED = "retired"
    CANCELLED = "cancelled"


class PolicyVersionStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    SUPERSEDED = "superseded"


class PolicyAcknowledgementStatus(str, Enum):
    PENDING = "pending"
    ACKNOWLEDGED = "acknowledged"
    OVERDUE = "overdue"
    WAIVED = "waived"


class ControlStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    RETIRED = "retired"


class ControlTestStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class RiskCategoryStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class RiskRegisterStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    OPEN = "open"
    MITIGATED = "mitigated"
    CLOSED = "closed"
    ACCEPTED = "accepted"
    CANCELLED = "cancelled"


class RiskAssessmentStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class RiskTreatmentStatus(str, Enum):
    DRAFT = "draft"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DEFERRED = "deferred"
    CANCELLED = "cancelled"


class ComplianceFrameworkStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    RETIRED = "retired"


class ComplianceRequirementStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ComplianceAssessmentStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    ARCHIVED = "archived"


class AuditPlanStatus(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    ACTIVE = "active"
    CLOSED = "closed"


class AuditStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class AuditFindingStatus(str, Enum):
    OPEN = "open"
    IN_REMEDIATION = "in_remediation"
    CLOSED = "closed"
    ACCEPTED = "accepted"


class CorrectiveActionStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    VERIFIED = "verified"
    CANCELLED = "cancelled"


class ExceptionStatus(str, Enum):
    DRAFT = "draft"
    OPEN = "open"
    UNDER_INVESTIGATION = "under_investigation"
    APPROVED = "approved"
    REJECTED = "rejected"
    CLOSED = "closed"
    EXPIRED = "expired"


class IncidentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    OPEN = "open"
    CONTAINED = "contained"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class NotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class GrcEntityType(str, Enum):
    POLICY = "policy"
    CONTROL = "control"
    CONTROL_TEST = "control_test"
    RISK = "risk"
    RISK_ASSESSMENT = "risk_assessment"
    RISK_TREATMENT = "risk_treatment"
    COMPLIANCE_ASSESSMENT = "compliance_assessment"
    AUDIT = "audit"
    FINDING = "finding"
    CAPA = "capa"
    EXCEPTION = "exception"
    INCIDENT = "incident"
    CATEGORY = "category"
    FRAMEWORK = "framework"
    PLAN = "plan"
    REPORT = "report"


CODE_PREFIXES: dict[GrcEntityType, tuple[str, int, bool]] = {
    GrcEntityType.POLICY: ("POL-", 6, True),
    GrcEntityType.CONTROL: ("CTL-", 6, True),
    GrcEntityType.CONTROL_TEST: ("CTT-", 6, True),
    GrcEntityType.RISK: ("RSK-", 6, True),
    GrcEntityType.RISK_ASSESSMENT: ("RAS-", 6, True),
    GrcEntityType.RISK_TREATMENT: ("RTR-", 6, True),
    GrcEntityType.COMPLIANCE_ASSESSMENT: ("CMP-", 6, True),
    GrcEntityType.AUDIT: ("AUD-", 6, True),
    GrcEntityType.FINDING: ("FND-", 6, True),
    GrcEntityType.CAPA: ("CAPA-", 6, True),
    GrcEntityType.EXCEPTION: ("EXC-", 6, True),
    GrcEntityType.INCIDENT: ("INC-", 6, True),
    GrcEntityType.CATEGORY: ("RCAT-", 6, False),
    GrcEntityType.FRAMEWORK: ("CFW-", 6, False),
    GrcEntityType.PLAN: ("APLN-", 6, False),
    GrcEntityType.REPORT: ("GRPT-", 6, False),
}
