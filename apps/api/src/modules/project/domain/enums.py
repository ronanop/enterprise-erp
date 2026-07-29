"""Project domain enums per ERD_14 §11."""

from enum import Enum


class ProjectStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    CLOSED = "closed"


class ProjectPhaseStatus(str, Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProjectMilestoneStatus(str, Enum):
    PLANNED = "planned"
    ACHIEVED = "achieved"
    DELAYED = "delayed"
    CANCELLED = "cancelled"


class ProjectTaskStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    SUBMITTED = "submitted"
    APPROVED = "approved"


class TaskDependencyStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class TaskAssignmentStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    REMOVED = "removed"


class TimesheetStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class TimesheetEntryStatus(str, Enum):
    DRAFT = "draft"
    LOCKED = "locked"
    CANCELLED = "cancelled"


class ResourcePlanStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ResourceAllocationStatus(str, Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProjectBudgetStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    CLOSED = "closed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ProjectCostStatus(str, Enum):
    DRAFT = "draft"
    POSTED = "posted"
    FAILED = "failed"
    REVERSED = "reversed"
    CANCELLED = "cancelled"


class ProjectIssueStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ProjectRiskStatus(str, Enum):
    IDENTIFIED = "identified"
    MITIGATING = "mitigating"
    ACCEPTED = "accepted"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ChangeRequestStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    IMPLEMENTED = "implemented"
    CANCELLED = "cancelled"


class ProjectDocumentStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    ARCHIVED = "archived"


class ProjectCommentStatus(str, Enum):
    ACTIVE = "active"
    EDITED = "edited"
    DELETED_SOFT = "deleted_soft"


class ProjectNotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ProjectReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class SiteDeliveryType(str, Enum):
    """Install scope selected at project intake."""

    SERVER_OS_RACK = "server_os_rack"  # server + OS + rack
    SERVER_OS = "server_os"  # server + OS
    SERVER_BIOS_RACK = "server_bios_rack"  # server + BIOS/FW + rack
    RACK_ONLY = "rack_only"  # rack installation only
    SERVER_BIOS = "server_bios"  # server + BIOS/FW


# Capability helpers for workflow branching
_RACK_SCOPES = {
    SiteDeliveryType.SERVER_OS_RACK.value,
    SiteDeliveryType.SERVER_BIOS_RACK.value,
    SiteDeliveryType.RACK_ONLY.value,
}
_SERVER_SCOPES = {
    SiteDeliveryType.SERVER_OS_RACK.value,
    SiteDeliveryType.SERVER_OS.value,
    SiteDeliveryType.SERVER_BIOS_RACK.value,
    SiteDeliveryType.SERVER_BIOS.value,
}
_OS_SCOPES = {
    SiteDeliveryType.SERVER_OS_RACK.value,
    SiteDeliveryType.SERVER_OS.value,
}
_BIOS_SCOPES = {
    SiteDeliveryType.SERVER_OS_RACK.value,
    SiteDeliveryType.SERVER_OS.value,
    SiteDeliveryType.SERVER_BIOS_RACK.value,
    SiteDeliveryType.SERVER_BIOS.value,
}


def delivery_includes_rack(delivery_type: str) -> bool:
    return delivery_type in _RACK_SCOPES


def delivery_includes_server(delivery_type: str) -> bool:
    return delivery_type in _SERVER_SCOPES


def delivery_includes_os(delivery_type: str) -> bool:
    return delivery_type in _OS_SCOPES


def delivery_includes_bios(delivery_type: str) -> bool:
    return delivery_type in _BIOS_SCOPES


def delivery_is_rack_only(delivery_type: str) -> bool:
    return delivery_type == SiteDeliveryType.RACK_ONLY.value


def delivery_needs_configuration(delivery_type: str) -> bool:
    return not delivery_is_rack_only(delivery_type)


def delivery_needs_hwat(delivery_type: str) -> bool:
    return not delivery_is_rack_only(delivery_type)


class SiteWorkflowStage(str, Enum):
    INTAKE = "intake"
    ASSIGNMENT = "assignment"
    SURVEY = "survey"
    SCM = "scm"
    INSTALLATION = "installation"
    CONFIGURATION = "configuration"
    ACCEPTANCE = "acceptance"
    COMPLETED = "completed"


class SiteInstallationStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PrjEntityType(str, Enum):
    PROJECT = "project"
    PROJECT_PHASE = "project_phase"
    PROJECT_MILESTONE = "project_milestone"
    PROJECT_TASK = "project_task"
    TIMESHEET = "timesheet"
    RESOURCE_PLAN = "resource_plan"
    PROJECT_BUDGET = "project_budget"
    PROJECT_COST = "project_cost"
    PROJECT_ISSUE = "project_issue"
    PROJECT_RISK = "project_risk"
    CHANGE_REQUEST = "change_request"
    PROJECT_REPORT = "project_report"
    SITE_INSTALLATION = "site_installation"


CODE_PREFIXES: dict[PrjEntityType, tuple[str, int, bool]] = {
    PrjEntityType.PROJECT: ("PRJ-", 6, True),
    PrjEntityType.PROJECT_PHASE: ("PPH-", 6, True),
    PrjEntityType.PROJECT_MILESTONE: ("PMS-", 6, True),
    PrjEntityType.PROJECT_TASK: ("TASK-", 6, True),
    PrjEntityType.TIMESHEET: ("TS-", 6, True),
    PrjEntityType.RESOURCE_PLAN: ("RPLAN-", 6, True),
    PrjEntityType.PROJECT_BUDGET: ("PBUD-", 6, True),
    PrjEntityType.PROJECT_COST: ("PCOST-", 6, True),
    PrjEntityType.PROJECT_ISSUE: ("PISS-", 6, True),
    PrjEntityType.PROJECT_RISK: ("PRISK-", 6, True),
    PrjEntityType.CHANGE_REQUEST: ("PCR-", 6, True),
    PrjEntityType.PROJECT_REPORT: ("PRPT-", 6, True),
    PrjEntityType.SITE_INSTALLATION: ("SITE-", 6, True),
}
