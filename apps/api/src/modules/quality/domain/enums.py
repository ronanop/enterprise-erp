"""Quality domain enums per ERD_09."""

from enum import Enum


class InspectionType(str, Enum):
    INCOMING = "incoming"
    IN_PROCESS = "in_process"
    FINAL = "final"
    CUSTOMER_RETURN = "customer_return"


class PlanStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    OBSOLETE = "obsolete"


class ActiveInactive(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class CharacteristicType(str, Enum):
    NUMERIC = "numeric"
    PASS_FAIL = "pass_fail"
    TEXT = "text"
    VISUAL = "visual"


class IncomingResult(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CONDITIONAL = "conditional"


class IncomingStatus(str, Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class InProcessResult(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    REWORK_REQUIRED = "rework_required"


class InProcessStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class FinalResult(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REWORK_REQUIRED = "rework_required"


class FinalStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Severity(str, Enum):
    MINOR = "minor"
    MAJOR = "major"
    CRITICAL = "critical"


class DefectStatus(str, Enum):
    OPEN = "open"
    LINKED_TO_NCR = "linked_to_ncr"
    CLOSED = "closed"


class NcrStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class CapaStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    VERIFIED = "verified"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class CapaType(str, Enum):
    CORRECTIVE = "corrective"
    PREVENTIVE = "preventive"
    BOTH = "both"


class ActionStatus(str, Enum):
    OPEN = "open"
    DONE = "done"
    VERIFIED = "verified"


class PublishStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


class ComplaintStatus(str, Enum):
    DRAFT = "draft"
    INVESTIGATING = "investigating"
    NCR_RAISED = "ncr_raised"
    CAPA_LINKED = "capa_linked"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class AuditStatus(str, Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class AuditType(str, Enum):
    INTERNAL = "internal"
    SUPPLIER = "supplier"
    PROCESS = "process"
    COMPLIANCE = "compliance"


class QmEntityType(str, Enum):
    INSPECTION_PLAN = "inspection_plan"
    SAMPLING_PLAN = "sampling_plan"
    INCOMING_INSPECTION = "incoming_inspection"
    INPROCESS_INSPECTION = "inprocess_inspection"
    FINAL_INSPECTION = "final_inspection"
    NCR = "ncr"
    CAPA = "capa"
    CUSTOMER_COMPLAINT = "customer_complaint"
    QUALITY_AUDIT = "quality_audit"
    DEFECT = "defect"


CODE_PREFIXES: dict[QmEntityType, tuple[str, int]] = {
    QmEntityType.INSPECTION_PLAN: ("QPL-", 6),
    QmEntityType.SAMPLING_PLAN: ("SMP-", 6),
    QmEntityType.INCOMING_INSPECTION: ("IQC-", 6),
    QmEntityType.INPROCESS_INSPECTION: ("IPQC-", 6),
    QmEntityType.FINAL_INSPECTION: ("FQC-", 6),
    QmEntityType.NCR: ("NCR-", 6),
    QmEntityType.CAPA: ("CAPA-", 6),
    QmEntityType.CUSTOMER_COMPLAINT: ("CQC-", 6),
    QmEntityType.QUALITY_AUDIT: ("QAD-", 6),
    QmEntityType.DEFECT: ("DEF-", 6),
}

SOURCE_MODULE = "quality"
