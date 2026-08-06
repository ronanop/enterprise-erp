"""Asset domain enums per ERD_15 section 11."""

from enum import Enum


class AssetCategoryStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class AssetStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    IN_MAINTENANCE = "in_maintenance"
    TRANSFERRED = "transferred"
    DISPOSED = "disposed"
    WRITTEN_OFF = "written_off"
    CANCELLED = "cancelled"


class AssetOperationalStatus(str, Enum):
    """IT operations status (CR-004). Orthogonal to AssetStatus lifecycle."""

    READY_TO_MOVE = "READY_TO_MOVE"
    ASSIGNED = "ASSIGNED"
    RETIRED = "RETIRED"
    PENDING_DISPOSAL = "PENDING_DISPOSAL"
    DISPOSED = "DISPOSED"


ASSET_OPERATIONAL_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in AssetOperationalStatus
)


class AssetComponentStatus(str, Enum):
    ACTIVE = "active"
    REPLACED = "replaced"
    DISPOSED = "disposed"


class AssetAssignmentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class AssignmentDeliveryReferenceStatus(str, Enum):
    """Delivery reference lifecycle on assignment (CR-004 Phase 5A-1)."""

    NOT_APPLICABLE = "not_applicable"
    PENDING = "pending"
    ISSUED = "issued"
    RECEIVED = "received"


ASSIGNMENT_DELIVERY_REFERENCE_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in AssignmentDeliveryReferenceStatus
)


class AssetTransferStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AssetLocationStatus(str, Enum):
    ACTIVE = "active"
    HISTORICAL = "historical"


class AssetWarrantyStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    EXTENDED = "extended"
    EXPIRED = "expired"
    VOID = "void"


class AssetInsuranceStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    RENEWED = "renewed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class AssetMaintenancePlanStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"


class AssetMaintenanceStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AssetServiceHistoryStatus(str, Enum):
    RECORDED = "recorded"


class AssetDepreciationStatus(str, Enum):
    DRAFT = "draft"
    CALCULATED = "calculated"
    POSTED = "posted"
    FAILED = "failed"
    REVERSED = "reversed"


class AssetDisposalStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    POSTED = "posted"
    CANCELLED = "cancelled"


class AssetRevaluationStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    POSTED = "posted"
    CANCELLED = "cancelled"


class AssetAuditStatus(str, Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AssetDocumentStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    ARCHIVED = "archived"


class AssetChecklistStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AssetMeterReadingStatus(str, Enum):
    RECORDED = "recorded"
    VOID = "void"


class AssetNotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class AssetNotificationType(str, Enum):
    MAINTENANCE_DUE = "maintenance_due"
    WARRANTY_EXPIRY = "warranty_expiry"
    INSURANCE_EXPIRY = "insurance_expiry"
    AUDIT_DUE = "audit_due"
    DEPRECIATION = "depreciation"
    OTHER = "other"


class AssetNotificationDeliveryStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    READ = "read"


class AssetNotificationEventSubtype(str, Enum):
    ASSIGNMENT = "assignment"
    DISPOSAL = "disposal"
    CUSTOM = "custom"
    MAINTENANCE_COMPLETED = "maintenance_completed"
    ASSET_RETURNED = "asset_returned"


class AssetReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class AssetReportSnapshotType(str, Enum):
    """Persisted ast_asset_report.report_type values (ERD + ADR expansion)."""

    REGISTER = "register"
    DEPRECIATION_SCHEDULE = "depreciation_schedule"
    UTILIZATION = "utilization"
    MAINTENANCE_DUE = "maintenance_due"
    INSURANCE_EXPIRY = "insurance_expiry"
    AUDIT_VARIANCE = "audit_variance"
    WARRANTY_EXPIRY = "warranty_expiry"
    ALLOCATION = "allocation"
    TRANSFER = "transfer"
    DISPOSAL = "disposal"
    DOCUMENTS = "documents"
    CHECKLISTS = "checklists"
    METERS = "meters"
    NOTIFICATIONS = "notifications"


class AssetLiveReportKey(str, Enum):
    """Live report_key catalog (not constrained by DB CHECK)."""

    ASSET_SUMMARY = "asset_summary"
    ASSET_INVENTORY = "asset_inventory"
    ASSET_ALLOCATION = "asset_allocation"
    ASSET_TRANSFERS = "asset_transfers"
    ASSET_MAINTENANCE = "asset_maintenance"
    MAINTENANCE_DUE = "maintenance_due"
    WARRANTY_EXPIRY = "warranty_expiry"
    INSURANCE_EXPIRY = "insurance_expiry"
    ASSET_DEPRECIATION = "asset_depreciation"
    ASSET_DISPOSAL = "asset_disposal"
    ASSET_DOCUMENTS = "asset_documents"
    ASSET_CHECKLISTS = "asset_checklists"
    ASSET_METER_READINGS = "asset_meter_readings"
    ASSET_NOTIFICATIONS = "asset_notifications"
    EXECUTIVE_DASHBOARD = "executive_dashboard"


# Live report_key → snapshot report_type
LIVE_TO_SNAPSHOT_TYPE: dict[str, str] = {
    AssetLiveReportKey.ASSET_SUMMARY.value: AssetReportSnapshotType.REGISTER.value,
    AssetLiveReportKey.ASSET_INVENTORY.value: AssetReportSnapshotType.REGISTER.value,
    AssetLiveReportKey.ASSET_ALLOCATION.value: AssetReportSnapshotType.ALLOCATION.value,
    AssetLiveReportKey.ASSET_TRANSFERS.value: AssetReportSnapshotType.TRANSFER.value,
    AssetLiveReportKey.ASSET_MAINTENANCE.value: AssetReportSnapshotType.MAINTENANCE_DUE.value,
    AssetLiveReportKey.MAINTENANCE_DUE.value: AssetReportSnapshotType.MAINTENANCE_DUE.value,
    AssetLiveReportKey.WARRANTY_EXPIRY.value: AssetReportSnapshotType.WARRANTY_EXPIRY.value,
    AssetLiveReportKey.INSURANCE_EXPIRY.value: AssetReportSnapshotType.INSURANCE_EXPIRY.value,
    AssetLiveReportKey.ASSET_DEPRECIATION.value: AssetReportSnapshotType.DEPRECIATION_SCHEDULE.value,
    AssetLiveReportKey.ASSET_DISPOSAL.value: AssetReportSnapshotType.DISPOSAL.value,
    AssetLiveReportKey.ASSET_DOCUMENTS.value: AssetReportSnapshotType.DOCUMENTS.value,
    AssetLiveReportKey.ASSET_CHECKLISTS.value: AssetReportSnapshotType.CHECKLISTS.value,
    AssetLiveReportKey.ASSET_METER_READINGS.value: AssetReportSnapshotType.METERS.value,
    AssetLiveReportKey.ASSET_NOTIFICATIONS.value: AssetReportSnapshotType.NOTIFICATIONS.value,
    AssetLiveReportKey.EXECUTIVE_DASHBOARD.value: AssetReportSnapshotType.UTILIZATION.value,
}


class AstEntityType(str, Enum):
    ASSET = "asset"
    ASSIGNMENT = "assignment"
    TRANSFER = "transfer"
    MAINTENANCE_PLAN = "maintenance_plan"
    MAINTENANCE = "maintenance"
    DEPRECIATION = "depreciation"
    DISPOSAL = "disposal"
    REVALUATION = "revaluation"
    AUDIT = "audit"
    REPORT = "report"


CODE_PREFIXES: dict[AstEntityType, tuple[str, int, bool]] = {
    AstEntityType.ASSET: ("AST-", 6, True),
    AstEntityType.ASSIGNMENT: ("AASN-", 6, True),
    AstEntityType.TRANSFER: ("ATRF-", 6, True),
    AstEntityType.MAINTENANCE_PLAN: ("AMPL-", 6, True),
    AstEntityType.MAINTENANCE: ("AMNT-", 6, True),
    AstEntityType.DEPRECIATION: ("ADEP-", 6, True),
    AstEntityType.DISPOSAL: ("ADISP-", 6, True),
    AstEntityType.REVALUATION: ("AREV-", 6, True),
    AstEntityType.AUDIT: ("AAUD-", 6, True),
    AstEntityType.REPORT: ("ARPT-", 6, True),
}
