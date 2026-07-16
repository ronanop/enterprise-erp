"""Customer Portal domain enums per ERD_23 section 8."""

from enum import Enum


class PortalAccountStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    LOCKED = "locked"
    SUSPENDED = "suspended"
    RETIRED = "retired"


class CustomerProfileStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    INACTIVE = "inactive"


class PortalSessionStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class DashboardStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class DashboardWidgetStatus(str, Enum):
    ACTIVE = "active"
    HIDDEN = "hidden"


class NotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class MessageThreadStatus(str, Enum):
    OPEN = "open"
    WAITING = "waiting"
    CLOSED = "closed"


class MessageStatus(str, Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    DELETED = "deleted"


class OrderViewStatus(str, Enum):
    VISIBLE = "visible"
    HIDDEN = "hidden"
    STALE = "stale"


class InvoiceViewStatus(str, Enum):
    VISIBLE = "visible"
    HIDDEN = "hidden"
    STALE = "stale"
    PAID_SNAPSHOT = "paid_snapshot"


class DocumentAccessStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


class SupportTicketStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ServiceRequestStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DownloadHistoryStatus(str, Enum):
    RECORDED = "recorded"
    FAILED = "failed"


class SavedReportStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class SavedSearchStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class PreferenceStatus(str, Enum):
    ACTIVE = "active"


class DeviceStatus(str, Enum):
    ACTIVE = "active"
    REVOKED = "revoked"


class LoginAuditStatus(str, Enum):
    RECORDED = "recorded"


class PortalReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class PortalEntityType(str, Enum):
    PORTAL_ACCOUNT = "portal_account"
    CUSTOMER_PROFILE = "customer_profile"
    PORTAL_SESSION = "portal_session"
    DASHBOARD = "dashboard"
    MESSAGE = "message"
    MESSAGE_THREAD = "message_thread"
    ORDER_VIEW = "order_view"
    INVOICE_VIEW = "invoice_view"
    DOCUMENT_ACCESS = "document_access"
    SUPPORT_TICKET = "support_ticket"
    SERVICE_REQUEST = "service_request"
    DOWNLOAD_HISTORY = "download_history"
    SAVED_REPORT = "saved_report"
    SAVED_SEARCH = "saved_search"
    DEVICE = "device"
    LOGIN_AUDIT = "login_audit"


CODE_PREFIXES: dict[PortalEntityType, tuple[str, int, bool]] = {
    PortalEntityType.PORTAL_ACCOUNT: ("ACC-", 6, True),
    PortalEntityType.CUSTOMER_PROFILE: ("PRF-", 6, True),
    PortalEntityType.PORTAL_SESSION: ("SES-", 6, True),
    PortalEntityType.DASHBOARD: ("DSH-", 6, True),
    PortalEntityType.MESSAGE: ("MSG-", 6, True),
    PortalEntityType.MESSAGE_THREAD: ("THR-", 6, True),
    PortalEntityType.ORDER_VIEW: ("ORD-", 6, True),
    PortalEntityType.INVOICE_VIEW: ("INV-", 6, True),
    PortalEntityType.DOCUMENT_ACCESS: ("DOC-", 6, True),
    PortalEntityType.SUPPORT_TICKET: ("TKT-", 6, True),
    PortalEntityType.SERVICE_REQUEST: ("SRQ-", 6, True),
    PortalEntityType.DOWNLOAD_HISTORY: ("DL-", 6, True),
    PortalEntityType.SAVED_REPORT: ("SVR-", 6, True),
    PortalEntityType.SAVED_SEARCH: ("SVS-", 6, True),
    PortalEntityType.DEVICE: ("DEV-", 6, True),
    PortalEntityType.LOGIN_AUDIT: ("AUD-", 6, True),
}

