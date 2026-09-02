"""Asset domain enums per ERD_15 section 11."""

from enum import Enum


class AssetDomain(str, Enum):
    """IT vs Non-IT partition of the asset register (additive domain flag)."""

    IT = "IT"
    NON_IT = "NON_IT"


ASSET_DOMAIN_VALUES: frozenset[str] = frozenset(s.value for s in AssetDomain)


class DomainMembershipRole(str, Enum):
    """Role within a single asset domain (IT or Non-IT team)."""

    ADMIN = "admin"
    MEMBER = "member"


DOMAIN_MEMBERSHIP_ROLE_VALUES: frozenset[str] = frozenset(
    s.value for s in DomainMembershipRole
)


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
    IN_MAINTENANCE = "IN_MAINTENANCE"
    RETIRED = "RETIRED"
    PENDING_DISPOSAL = "PENDING_DISPOSAL"
    DISPOSED = "DISPOSED"
    IN_USE_AS_COMPONENT = "IN_USE_AS_COMPONENT"


ASSET_OPERATIONAL_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in AssetOperationalStatus
)


class IncomingAssetArrivalStatus(str, Enum):
    """IT physical receiving status for GRN-sourced incoming lines (not ast_asset ops)."""

    EXPECTED = "EXPECTED"
    PARTIALLY_ARRIVED = "PARTIALLY_ARRIVED"
    ARRIVED = "ARRIVED"


INCOMING_ASSET_ARRIVAL_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in IncomingAssetArrivalStatus
)


class IncomingAssetUnitStatus(str, Enum):
    PENDING = "PENDING"
    ARRIVED = "ARRIVED"


INCOMING_ASSET_UNIT_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in IncomingAssetUnitStatus
)


class IncomingAssetQcStatus(str, Enum):
    """Line-level QC orchestration status (orthogonal to arrival status)."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


INCOMING_ASSET_QC_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in IncomingAssetQcStatus
)


class IncomingAssetUnitQcStatus(str, Enum):
    """Unit-level QC disposition after physical arrival."""

    PENDING_QC = "PENDING_QC"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


INCOMING_ASSET_UNIT_QC_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in IncomingAssetUnitQcStatus
)


class IncomingRegistrationStatus(str, Enum):
    """Derived registration progress for QC-accepted incoming (not asset lifecycle/ops)."""

    PENDING_REGISTRATION = "PENDING_REGISTRATION"
    PARTIALLY_REGISTERED = "PARTIALLY_REGISTERED"
    REGISTERED = "REGISTERED"


INCOMING_REGISTRATION_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in IncomingRegistrationStatus
)


class AssetComponentStatus(str, Enum):
    ACTIVE = "active"
    REPLACED = "replaced"
    DISPOSED = "disposed"


class AssetComponentType(str, Enum):
    """Typed accessory categories for IT assets (Sub-phase 4C)."""

    CHARGER = "CHARGER"
    MOUSE = "MOUSE"
    KEYBOARD = "KEYBOARD"
    CABLE = "CABLE"
    PENDRIVE = "PENDRIVE"
    LAPTOP_BAG = "LAPTOP_BAG"
    OTHER = "OTHER"


ASSET_COMPONENT_TYPE_VALUES: frozenset[str] = frozenset(t.value for t in AssetComponentType)


class AssignmentComponentIssueStatus(str, Enum):
    """Custody state of a component on an assignment (Sub-phase 4C)."""

    ISSUED = "ISSUED"
    RETURNED = "RETURNED"
    MISSING = "MISSING"
    DAMAGED = "DAMAGED"
    RETAINED = "RETAINED"


ASSIGNMENT_COMPONENT_ISSUE_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in AssignmentComponentIssueStatus
)

# Terminal custody states — component must not become available again automatically.
ASSIGNMENT_COMPONENT_UNAVAILABLE_STATUSES: frozenset[str] = frozenset(
    {
        AssignmentComponentIssueStatus.ISSUED.value,
        AssignmentComponentIssueStatus.MISSING.value,
        AssignmentComponentIssueStatus.DAMAGED.value,
        AssignmentComponentIssueStatus.RETAINED.value,
    }
)

ASSIGNMENT_COMPONENT_RETURN_OUTCOMES: frozenset[str] = frozenset(
    {
        AssignmentComponentIssueStatus.RETURNED.value,
        AssignmentComponentIssueStatus.MISSING.value,
        AssignmentComponentIssueStatus.DAMAGED.value,
        AssignmentComponentIssueStatus.RETAINED.value,
    }
)


class AssetAssignmentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class AssignmentEmployeeSource(str, Enum):
    """How an employee allocation identifies the recipient (same allocation_type)."""

    MASTER_DATA = "MASTER_DATA"
    MANUAL_ENTRY = "MANUAL_ENTRY"


ASSIGNMENT_EMPLOYEE_SOURCE_VALUES: frozenset[str] = frozenset(
    s.value for s in AssignmentEmployeeSource
)


class AssignmentDeliveryReferenceStatus(str, Enum):
    """Delivery reference lifecycle on assignment (CR-004 Phase 5A-1)."""

    NOT_APPLICABLE = "not_applicable"
    PENDING = "pending"
    ISSUED = "issued"
    RECEIVED = "received"


ASSIGNMENT_DELIVERY_REFERENCE_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in AssignmentDeliveryReferenceStatus
)


class AssignmentDeliveryChallanSignatureStatus(str, Enum):
    """Independent signature dimension for delivery challan (Sub-phase 4D)."""

    NOT_SIGNED = "not_signed"
    SIGNED = "signed"


ASSIGNMENT_DELIVERY_CHALLAN_SIGNATURE_STATUS_VALUES: frozenset[str] = frozenset(
    s.value for s in AssignmentDeliveryChallanSignatureStatus
)


class DcChallanStatus(str, Enum):
    """Standalone DC challan workflow (IT ↔ SCM paperwork)."""

    PENDING = "PENDING"
    SENT_TO_SCM = "SENT_TO_SCM"
    DOCUMENT_RECEIVED = "DOCUMENT_RECEIVED"
    SIGNED = "SIGNED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


DC_CHALLAN_STATUS_VALUES: frozenset[str] = frozenset(s.value for s in DcChallanStatus)

# Assignment cancel/return auto-cancel these (SIGNED is unfinished filing).
DC_CHALLAN_ASSIGNMENT_AUTO_CANCEL_STATUSES: frozenset[str] = frozenset(
    {
        DcChallanStatus.PENDING.value,
        DcChallanStatus.SENT_TO_SCM.value,
        DcChallanStatus.DOCUMENT_RECEIVED.value,
        DcChallanStatus.SIGNED.value,
    }
)

# Ops RETIRED/PENDING_DISPOSAL/DISPOSED: leave SIGNED/RECEIVED as historical handover.
DC_CHALLAN_OPS_AUTO_CANCEL_STATUSES: frozenset[str] = frozenset(
    {
        DcChallanStatus.PENDING.value,
        DcChallanStatus.SENT_TO_SCM.value,
        DcChallanStatus.DOCUMENT_RECEIVED.value,
    }
)


class DcChallanDocKind(str, Enum):
    SCM_ISSUED = "SCM_ISSUED"
    SIGNED = "SIGNED"


class DcChallanDocSource(str, Enum):
    SCM_CALLBACK = "SCM_CALLBACK"
    MANUAL_UPLOAD = "MANUAL_UPLOAD"


DC_CHALLAN_DOC_KIND_VALUES: frozenset[str] = frozenset(s.value for s in DcChallanDocKind)
DC_CHALLAN_DOC_SOURCE_VALUES: frozenset[str] = frozenset(s.value for s in DcChallanDocSource)

DOC_KIND_PATH_ALIASES: dict[str, str] = {
    "scm-issued": DcChallanDocKind.SCM_ISSUED.value,
    "scm_issued": DcChallanDocKind.SCM_ISSUED.value,
    "SCM_ISSUED": DcChallanDocKind.SCM_ISSUED.value,
    "signed": DcChallanDocKind.SIGNED.value,
    "SIGNED": DcChallanDocKind.SIGNED.value,
}


def normalize_dc_doc_kind(value: str) -> str:
    mapped = DOC_KIND_PATH_ALIASES.get(value) or DOC_KIND_PATH_ALIASES.get(value.strip())
    if mapped:
        return mapped
    raise ValueError(value)


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
    DC_CHALLAN = "dc_challan"


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
    AstEntityType.DC_CHALLAN: ("DC-", 6, True),
}


# --- Non-IT asset register (separate tables; not ast_asset) ---


class NonItAssignmentMode(str, Enum):
    EMPLOYEE = "EMPLOYEE"
    LOCATION = "LOCATION"
    BOTH = "BOTH"


NONIT_ASSIGNMENT_MODE_VALUES: frozenset[str] = frozenset(s.value for s in NonItAssignmentMode)


class NonItAssetStatus(str, Enum):
    IN_STOCK = "IN_STOCK"
    ASSIGNED = "ASSIGNED"
    MAINTENANCE = "MAINTENANCE"
    DISPOSED = "DISPOSED"


NONIT_ASSET_STATUS_VALUES: frozenset[str] = frozenset(s.value for s in NonItAssetStatus)


class NonItTimelineEventType(str, Enum):
    CREATED = "CREATED"
    ASSIGNED = "ASSIGNED"
    UNASSIGNED = "UNASSIGNED"
    LOCATION_CHANGED = "LOCATION_CHANGED"
    STATUS_CHANGED = "STATUS_CHANGED"
    MAINTENANCE_STARTED = "MAINTENANCE_STARTED"
    MAINTENANCE_COMPLETED = "MAINTENANCE_COMPLETED"
    DISPOSED = "DISPOSED"
    IMPORTED = "IMPORTED"


class NonItLocationKind(str, Enum):
    """Physical place categories for Non-IT assignment targets."""

    CONFERENCE_ROOM = "CONFERENCE_ROOM"
    MEETING_ROOM = "MEETING_ROOM"
    DEPARTMENT = "DEPARTMENT"
    FLOOR = "FLOOR"
    CABIN = "CABIN"
    LOBBY = "LOBBY"
    CAFETERIA = "CAFETERIA"
    COMMON_AREA = "COMMON_AREA"
    WAREHOUSE = "WAREHOUSE"
    PARKING = "PARKING"
    OTHER = "OTHER"


NONIT_LOCATION_KIND_VALUES: frozenset[str] = frozenset(s.value for s in NonItLocationKind)


class NonItAssetTypeCategory(str, Enum):
    """High-level Non-IT type groupings for admin UX / filters."""

    FURNITURE = "FURNITURE"
    APPLIANCE = "APPLIANCE"
    ELECTRONICS = "ELECTRONICS"
    FIXTURE = "FIXTURE"
    EQUIPMENT = "EQUIPMENT"
    STORAGE = "STORAGE"
    OTHER = "OTHER"


NONIT_ASSET_TYPE_CATEGORY_VALUES: frozenset[str] = frozenset(
    s.value for s in NonItAssetTypeCategory
)


NONIT_TIMELINE_EVENT_TYPE_VALUES: frozenset[str] = frozenset(
    s.value for s in NonItTimelineEventType
)
