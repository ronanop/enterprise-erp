"""Service domain enums per ERD_16 section 11."""

from enum import Enum


class ServiceCategoryStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ServiceRequestStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    NEW = "new"
    TICKET_REGISTERED = "ticket_registered"
    AWAITING_ASSIGNMENT = "awaiting_assignment"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    ENGINEER_WORKING = "engineer_working"
    PENDING_CUSTOMER = "pending_customer"
    PENDING_OEM = "pending_oem"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ModeOfAction(str, Enum):
    REMOTE_SUPPORT = "remote_support"
    ONSITE_SUPPORT = "onsite_support"
    OEM_SUPPORT = "oem_support"


class TicketCategory(str, Enum):
    HARDWARE = "hardware"
    SOFTWARE = "software"
    NETWORK = "network"


class TicketPriority(str, Enum):
    P1 = "p1"
    P2 = "p2"
    P3 = "p3"
    P4 = "p4"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ServiceTicketStatus(str, Enum):
    OPEN = "open"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ServiceAssignmentStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ServiceScheduleStatus(str, Enum):
    PLANNED = "planned"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ServiceWorkOrderStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ServiceTaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"


class ServiceChecklistStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ServiceVisitStatus(str, Enum):
    PLANNED = "planned"
    CHECKED_IN = "checked_in"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ServiceMaterialStatus(str, Enum):
    RESERVED = "reserved"
    ISSUED = "issued"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class ServiceTimeEntryStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    VOID = "void"


class ServiceExpenseStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    POSTED = "posted"
    CANCELLED = "cancelled"


class ServiceSlaStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ServiceEscalationStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class ServiceFeedbackStatus(str, Enum):
    CAPTURED = "captured"
    REVIEWED = "reviewed"
    ARCHIVED = "archived"


class ServiceResolutionStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ServiceDocumentStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    ARCHIVED = "archived"


class ServiceNotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ServiceContractStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class ServiceReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class SvcEntityType(str, Enum):
    REQUEST = "request"
    TICKET = "ticket"
    ASSIGNMENT = "assignment"
    SCHEDULE = "schedule"
    WORK_ORDER = "work_order"
    VISIT = "visit"
    EXPENSE = "expense"
    ESCALATION = "escalation"
    RESOLUTION = "resolution"
    CONTRACT = "contract"
    REPORT = "report"
    CATEGORY = "category"
    SLA = "sla"


CODE_PREFIXES: dict[SvcEntityType, tuple[str, int, bool]] = {
    SvcEntityType.REQUEST: ("SR-", 6, True),
    SvcEntityType.TICKET: ("TKT-", 6, True),
    SvcEntityType.ASSIGNMENT: ("SASN-", 6, True),
    SvcEntityType.SCHEDULE: ("SSCH-", 6, True),
    SvcEntityType.WORK_ORDER: ("WO-SRV-", 6, True),
    SvcEntityType.VISIT: ("SVIS-", 6, True),
    SvcEntityType.EXPENSE: ("SEXP-", 6, True),
    SvcEntityType.ESCALATION: ("SESC-", 6, True),
    SvcEntityType.RESOLUTION: ("SRES-", 6, True),
    SvcEntityType.CONTRACT: ("SC-", 6, True),
    SvcEntityType.REPORT: ("SRPT-", 6, True),
    SvcEntityType.CATEGORY: ("SCAT-", 6, False),
    SvcEntityType.SLA: ("SSLA-", 6, False),
}
