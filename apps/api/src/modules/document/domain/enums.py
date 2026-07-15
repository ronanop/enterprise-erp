"""Document domain enums per ERD_18 section 11."""

from enum import Enum


class FolderStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class DocumentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    CHECKED_OUT = "checked_out"
    ARCHIVED = "archived"
    EXPIRED = "expired"
    DISPOSED = "disposed"
    CANCELLED = "cancelled"


class DocumentVersionStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    DELETED_SOFT = "deleted_soft"


class DocumentMetadataStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class DocumentTagStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class DocumentTagMapStatus(str, Enum):
    ACTIVE = "active"
    REMOVED = "removed"


class DocumentPermissionStatus(str, Enum):
    ACTIVE = "active"
    REVOKED = "revoked"


class DocumentShareStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class DocumentCommentStatus(str, Enum):
    ACTIVE = "active"
    DELETED_SOFT = "deleted_soft"


class DocumentApprovalStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DocumentWorkflowStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class DocumentCheckoutStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DocumentAuditStatus(str, Enum):
    RECORDED = "recorded"


class DocumentAttachmentStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    ARCHIVED = "archived"


class TemplateStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class TemplateFieldStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class RetentionPolicyStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    INACTIVE = "inactive"


class ArchiveStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ARCHIVED = "archived"
    RESTORED = "restored"
    DISPOSED = "disposed"


class NotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class DocEntityType(str, Enum):
    DOCUMENT = "document"
    SHARE = "share"
    APPROVAL = "approval"
    CHECKOUT = "checkout"
    ARCHIVE = "archive"
    FOLDER = "folder"
    TAG = "tag"
    TEMPLATE = "template"
    WORKFLOW = "workflow"
    RETENTION = "retention"
    REPORT = "report"


CODE_PREFIXES: dict[DocEntityType, tuple[str, int, bool]] = {
    DocEntityType.DOCUMENT: ("DOC-", 6, True),
    DocEntityType.SHARE: ("DSHR-", 6, True),
    DocEntityType.APPROVAL: ("DAPR-", 6, True),
    DocEntityType.CHECKOUT: ("DOUT-", 6, True),
    DocEntityType.ARCHIVE: ("DARC-", 6, True),
    DocEntityType.FOLDER: ("DF-", 6, False),
    DocEntityType.TAG: ("DTAG-", 6, False),
    DocEntityType.TEMPLATE: ("DTPL-", 6, False),
    DocEntityType.WORKFLOW: ("DWF-", 6, False),
    DocEntityType.RETENTION: ("DRTN-", 6, False),
    DocEntityType.REPORT: ("DRPT-", 6, False),
}
