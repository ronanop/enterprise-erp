"""Analytics domain enums per ERD_20 section 11."""

from enum import Enum


class DashboardStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class DashboardWidgetStatus(str, Enum):
    ACTIVE = "active"
    HIDDEN = "hidden"
    ARCHIVED = "archived"


class ReportStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class ReportScheduleStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    RETIRED = "retired"


class ReportExecutionStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DatasetStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    REFRESHING = "refreshing"
    FAILED = "failed"
    RETIRED = "retired"


class DatasetSourceStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class MetricStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"


class KpiStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    INACTIVE = "inactive"
    CANCELLED = "cancelled"


class DimensionStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class FactTableStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    REBUILDING = "rebuilding"
    RETIRED = "retired"


class DataSnapshotStatus(str, Enum):
    READY = "ready"
    EXPIRED = "expired"
    FAILED = "failed"


class DataRefreshStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AlertRuleStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    PAUSED = "paused"
    RETIRED = "retired"


class AlertNotificationStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    CLOSED = "closed"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class DataExportStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    EXPIRED = "expired"


class DataImportStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class QueryHistoryStatus(str, Enum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    TIMEOUT = "timeout"
    RECORDED = "recorded"


class UsageAuditStatus(str, Enum):
    RECORDED = "recorded"


class AnalyticsEntityType(str, Enum):
    DASHBOARD = "dashboard"
    REPORT = "report"
    REPORT_EXECUTION = "report_execution"
    DATASET = "dataset"
    KPI = "kpi"
    ALERT = "alert"
    SUBSCRIPTION = "subscription"
    EXPORT = "export"
    IMPORT = "import"
    REFRESH = "refresh"
    SNAPSHOT = "snapshot"


CODE_PREFIXES: dict[AnalyticsEntityType, tuple[str, int, bool]] = {
    AnalyticsEntityType.DASHBOARD: ("DASH-", 6, True),
    AnalyticsEntityType.REPORT: ("RPT-", 6, True),
    AnalyticsEntityType.REPORT_EXECUTION: ("REX-", 6, True),
    AnalyticsEntityType.DATASET: ("DS-", 6, True),
    AnalyticsEntityType.KPI: ("KPI-", 6, True),
    AnalyticsEntityType.ALERT: ("ALR-", 6, True),
    AnalyticsEntityType.SUBSCRIPTION: ("SUB-", 6, True),
    AnalyticsEntityType.EXPORT: ("EXP-", 6, True),
    AnalyticsEntityType.IMPORT: ("IMP-", 6, True),
    AnalyticsEntityType.REFRESH: ("RFH-", 6, True),
    AnalyticsEntityType.SNAPSHOT: ("SNP-", 6, True),
}
