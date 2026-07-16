"""Customer Portal domain exceptions."""

from core.exceptions import ConflictException


class InvalidPortalAccountState(ConflictException):
    def __init__(self, message: str = "Invalid portalaccount state") -> None:
        super().__init__(message)

class InvalidCustomerProfileState(ConflictException):
    def __init__(self, message: str = "Invalid customerprofile state") -> None:
        super().__init__(message)

class InvalidPortalSessionState(ConflictException):
    def __init__(self, message: str = "Invalid portalsession state") -> None:
        super().__init__(message)

class InvalidDashboardState(ConflictException):
    def __init__(self, message: str = "Invalid dashboard state") -> None:
        super().__init__(message)

class InvalidDashboardWidgetState(ConflictException):
    def __init__(self, message: str = "Invalid dashboardwidget state") -> None:
        super().__init__(message)

class InvalidNotificationState(ConflictException):
    def __init__(self, message: str = "Invalid notification state") -> None:
        super().__init__(message)

class InvalidMessageThreadState(ConflictException):
    def __init__(self, message: str = "Invalid messagethread state") -> None:
        super().__init__(message)

class InvalidMessageState(ConflictException):
    def __init__(self, message: str = "Invalid message state") -> None:
        super().__init__(message)

class InvalidOrderViewState(ConflictException):
    def __init__(self, message: str = "Invalid orderview state") -> None:
        super().__init__(message)

class InvalidInvoiceViewState(ConflictException):
    def __init__(self, message: str = "Invalid invoiceview state") -> None:
        super().__init__(message)

class InvalidDocumentAccessState(ConflictException):
    def __init__(self, message: str = "Invalid documentaccess state") -> None:
        super().__init__(message)

class InvalidSupportTicketState(ConflictException):
    def __init__(self, message: str = "Invalid supportticket state") -> None:
        super().__init__(message)

class InvalidServiceRequestState(ConflictException):
    def __init__(self, message: str = "Invalid servicerequest state") -> None:
        super().__init__(message)

class InvalidDownloadHistoryState(ConflictException):
    def __init__(self, message: str = "Invalid downloadhistory state") -> None:
        super().__init__(message)

class InvalidSavedReportState(ConflictException):
    def __init__(self, message: str = "Invalid savedreport state") -> None:
        super().__init__(message)

class InvalidSavedSearchState(ConflictException):
    def __init__(self, message: str = "Invalid savedsearch state") -> None:
        super().__init__(message)

class InvalidPreferenceState(ConflictException):
    def __init__(self, message: str = "Invalid preference state") -> None:
        super().__init__(message)

class InvalidDeviceState(ConflictException):
    def __init__(self, message: str = "Invalid device state") -> None:
        super().__init__(message)

class InvalidLoginAuditState(ConflictException):
    def __init__(self, message: str = "Invalid loginaudit state") -> None:
        super().__init__(message)

class InvalidPortalReportState(ConflictException):
    def __init__(self, message: str = "Invalid portalreport state") -> None:
        super().__init__(message)
