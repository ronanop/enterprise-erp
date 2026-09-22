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
    SELLING_ENTITY = "selling_entity"
    APPROVAL_TASK = "approval_task"
    KYC = "kyc"


CODE_PREFIXES: dict[CrmEntityType, tuple[str, int]] = {
    # width = zero-pad length for the trailing sequence (0 = no padding → QT-2026-14).
    CrmEntityType.LEAD: ("LEAD-", 0),
    CrmEntityType.OPPORTUNITY: ("OPP-", 0),
    CrmEntityType.CAMPAIGN: ("CMP-", 0),
    CrmEntityType.PIPELINE: ("PIPE-", 0),
    CrmEntityType.TASK: ("TSK-", 0),
    CrmEntityType.FOLLOWUP: ("FU-", 0),
    CrmEntityType.MEETING: ("MTG-", 0),
    CrmEntityType.INTERACTION: ("INT-", 0),
    CrmEntityType.FEEDBACK: ("FBK-", 0),
    CrmEntityType.COMPANY: ("COMP-", 2),
    CrmEntityType.QUOTE: ("QT-", 0),
    CrmEntityType.OVF: ("OVF-", 0),
    CrmEntityType.PRODUCT: ("PRD-", 0),
    CrmEntityType.OEM: ("OEM-", 0),
    CrmEntityType.SELLING_ENTITY: ("ENT-", 0),
    CrmEntityType.APPROVAL_TASK: ("JOB-", 0),
    CrmEntityType.KYC: ("KYC-", 0),
}

# Team roles that can receive a "My Jobs" approval task. ``legal`` validates
# customer PO terms & conditions - that validation never sits with Sales.
APPROVAL_TEAM_ROLES = ("presales", "project", "management", "accounts", "scm", "legal")
APPROVAL_TASK_STATUSES = ("pending", "approved", "rejected", "cancelled")

SOURCE_MODULE = "crm"
