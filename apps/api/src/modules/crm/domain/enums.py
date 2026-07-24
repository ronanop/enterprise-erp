"""CRM domain enums per ERD_10."""

from enum import Enum


class ActiveInactive(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class LeadStatus(str, Enum):
    NEW = "new"
    ASSIGNED = "assigned"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    UNQUALIFIED = "unqualified"
    CONVERTED = "converted"
    LOST = "lost"


class AssignmentType(str, Enum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"


class AssignmentStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"


class ActivityType(str, Enum):
    CALL = "call"
    MEETING = "meeting"
    EMAIL = "email"
    TASK = "task"
    FOLLOW_UP = "follow_up"
    NOTE = "note"


class ActivityStatus(str, Enum):
    PLANNED = "planned"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class OpportunityStage(str, Enum):
    QUALIFICATION = "qualification"
    DISCOVERY = "discovery"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"


class OpportunityStatus(str, Enum):
    OPEN = "open"
    WON = "won"
    LOST = "lost"
    CANCELLED = "cancelled"


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CampaignType(str, Enum):
    EMAIL = "email"
    EVENT = "event"
    SOCIAL = "social"
    TELE = "tele"
    MIXED = "mixed"


class MemberType(str, Enum):
    LEAD = "lead"
    CUSTOMER = "customer"


class MemberStatus(str, Enum):
    INVITED = "invited"
    RESPONDED = "responded"
    CONVERTED = "converted"
    UNSUBSCRIBED = "unsubscribed"


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class FollowupStatus(str, Enum):
    SCHEDULED = "scheduled"
    DONE = "done"
    MISSED = "missed"
    CANCELLED = "cancelled"


class MeetingStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MeetingOutcome(str, Enum):
    INTERESTED = "interested"
    NEED_FOLLOW_UP = "need_follow_up"
    CLOSED = "closed"
    NO_SHOW = "no_show"


class InteractionStatus(str, Enum):
    OPEN = "open"
    COMPLETED = "completed"


class FeedbackStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    CLOSED = "closed"


class PublishStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


class Direction(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class CrmEntityType(str, Enum):
    LEAD = "lead"
    OPPORTUNITY = "opportunity"
    CAMPAIGN = "campaign"
    PIPELINE = "pipeline"
    TASK = "task"
    FOLLOWUP = "followup"
    MEETING = "meeting"
    INTERACTION = "interaction"
    FEEDBACK = "feedback"
    COMPANY = "company"
    QUOTE = "quote"
    OVF = "ovf"
    PRODUCT = "product"
    OEM = "oem"
    APPROVAL_TASK = "approval_task"


CODE_PREFIXES: dict[CrmEntityType, tuple[str, int]] = {
    CrmEntityType.LEAD: ("LEAD-", 6),
    CrmEntityType.OPPORTUNITY: ("OPP-", 6),
    CrmEntityType.CAMPAIGN: ("CMP-", 6),
    CrmEntityType.PIPELINE: ("PIPE-", 6),
    CrmEntityType.TASK: ("TSK-", 6),
    CrmEntityType.FOLLOWUP: ("FU-", 6),
    CrmEntityType.MEETING: ("MTG-", 6),
    CrmEntityType.INTERACTION: ("INT-", 6),
    CrmEntityType.FEEDBACK: ("FBK-", 6),
    CrmEntityType.COMPANY: ("ACC-", 6),
    CrmEntityType.QUOTE: ("QT-", 6),
    CrmEntityType.OVF: ("OVF-", 6),
    CrmEntityType.PRODUCT: ("PRD-", 6),
    CrmEntityType.OEM: ("OEM-", 6),
    CrmEntityType.APPROVAL_TASK: ("JOB-", 6),
}

# Team roles that can receive a "My Jobs" approval task.
APPROVAL_TEAM_ROLES = ("presales", "project", "management", "accounts", "scm")
APPROVAL_TASK_STATUSES = ("pending", "approved", "rejected", "cancelled")

SOURCE_MODULE = "crm"
