"""Analytics domain exceptions."""

from core.exceptions import ConflictException


class InvalidDashboardState(ConflictException):
    def __init__(self, message: str = "Invalid dashboard state") -> None:
        super().__init__(message)

class InvalidDashboardWidgetState(ConflictException):
    def __init__(self, message: str = "Invalid dashboardwidget state") -> None:
        super().__init__(message)

class InvalidReportState(ConflictException):
    def __init__(self, message: str = "Invalid report state") -> None:
        super().__init__(message)

class InvalidReportScheduleState(ConflictException):
    def __init__(self, message: str = "Invalid reportschedule state") -> None:
        super().__init__(message)

class InvalidReportExecutionState(ConflictException):
    def __init__(self, message: str = "Invalid reportexecution state") -> None:
        super().__init__(message)

class InvalidDatasetState(ConflictException):
    def __init__(self, message: str = "Invalid dataset state") -> None:
        super().__init__(message)

class InvalidDatasetSourceState(ConflictException):
    def __init__(self, message: str = "Invalid datasetsource state") -> None:
        super().__init__(message)

class InvalidMetricState(ConflictException):
    def __init__(self, message: str = "Invalid metric state") -> None:
        super().__init__(message)

class InvalidKpiState(ConflictException):
    def __init__(self, message: str = "Invalid kpi state") -> None:
        super().__init__(message)

class InvalidDimensionState(ConflictException):
    def __init__(self, message: str = "Invalid dimension state") -> None:
        super().__init__(message)

class InvalidFactTableState(ConflictException):
    def __init__(self, message: str = "Invalid facttable state") -> None:
        super().__init__(message)

class InvalidDataSnapshotState(ConflictException):
    def __init__(self, message: str = "Invalid datasnapshot state") -> None:
        super().__init__(message)

class InvalidDataRefreshState(ConflictException):
    def __init__(self, message: str = "Invalid datarefresh state") -> None:
        super().__init__(message)

class InvalidAlertRuleState(ConflictException):
    def __init__(self, message: str = "Invalid alertrule state") -> None:
        super().__init__(message)

class InvalidAlertNotificationState(ConflictException):
    def __init__(self, message: str = "Invalid alertnotification state") -> None:
        super().__init__(message)

class InvalidSubscriptionState(ConflictException):
    def __init__(self, message: str = "Invalid subscription state") -> None:
        super().__init__(message)

class InvalidDataExportState(ConflictException):
    def __init__(self, message: str = "Invalid dataexport state") -> None:
        super().__init__(message)

class InvalidDataImportState(ConflictException):
    def __init__(self, message: str = "Invalid dataimport state") -> None:
        super().__init__(message)

class InvalidQueryHistoryState(ConflictException):
    def __init__(self, message: str = "Invalid queryhistory state") -> None:
        super().__init__(message)

class InvalidUsageAuditState(ConflictException):
    def __init__(self, message: str = "Invalid usageaudit state") -> None:
        super().__init__(message)
