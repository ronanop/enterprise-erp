"""Helpdesk domain enums per ERD_17 section 11."""

from enum import Enum


class TicketCategoryStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class TicketPriorityStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class TicketStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    NEW = "new"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class TicketAssignmentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TicketStatusHistoryStatus(str, Enum):
    RECORDED = "recorded"


class TicketCommentStatus(str, Enum):
    ACTIVE = "active"
    DELETED_SOFT = "deleted_soft"


class TicketAttachmentStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    ARCHIVED = "archived"


class TicketActivityStatus(str, Enum):
    RECORDED = "recorded"


class TicketSlaStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class TicketEscalationStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class KnowledgeBaseStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class KnowledgeArticleStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class ResolutionStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CustomerFeedbackStatus(str, Enum):
    CAPTURED = "captured"
    REVIEWED = "reviewed"
    ARCHIVED = "archived"


class SupportTeamStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class SupportShiftStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class SupportScheduleStatus(str, Enum):
    PLANNED = "planned"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TicketNotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class TicketReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class TicketDashboardStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class HdEntityType(str, Enum):
    TICKET = "ticket"
    ASSIGNMENT = "assignment"
    ESCALATION = "escalation"
    ARTICLE = "article"
    RESOLUTION = "resolution"
    SCHEDULE = "schedule"
    CATEGORY = "category"
    PRIORITY = "priority"
    SLA = "sla"
    KB = "kb"
    TEAM = "team"
    REPORT = "report"
    DASHBOARD = "dashboard"


CODE_PREFIXES: dict[HdEntityType, tuple[str, int, bool]] = {
    HdEntityType.TICKET: ("TKT-", 6, True),
    HdEntityType.ASSIGNMENT: ("HDAS-", 6, True),
    HdEntityType.ESCALATION: ("HDES-", 6, True),
    HdEntityType.ARTICLE: ("HDKA-", 6, True),
    HdEntityType.RESOLUTION: ("HDRES-", 6, True),
    HdEntityType.SCHEDULE: ("HDSS-", 6, True),
    HdEntityType.CATEGORY: ("HDCAT-", 6, False),
    HdEntityType.PRIORITY: ("HDPRI-", 6, False),
    HdEntityType.SLA: ("HDSLA-", 6, False),
    HdEntityType.KB: ("HDKB-", 6, False),
    HdEntityType.TEAM: ("HDTM-", 6, False),
    HdEntityType.REPORT: ("HDRPT-", 6, False),
    HdEntityType.DASHBOARD: ("HDDash-", 6, False),
}
