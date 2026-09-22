"""HR domain exceptions."""

from core.exceptions import ConflictException


class InvalidDesignationState(ConflictException):
    def __init__(self, message: str = "Invalid designation state") -> None:
        super().__init__(message)


class InvalidEmployeeProfileState(ConflictException):
    def __init__(self, message: str = "Invalid employee profile state") -> None:
        super().__init__(message)


class InvalidEmploymentState(ConflictException):
    def __init__(self, message: str = "Invalid employment state") -> None:
        super().__init__(message)


class InvalidAssignmentState(ConflictException):
    def __init__(self, message: str = "Invalid assignment state") -> None:
        super().__init__(message)


class InvalidShiftState(ConflictException):
    def __init__(self, message: str = "Invalid shift state") -> None:
        super().__init__(message)


class InvalidShiftAssignmentState(ConflictException):
    def __init__(self, message: str = "Invalid shift assignment state") -> None:
        super().__init__(message)


class InvalidHolidayCalendarState(ConflictException):
    def __init__(self, message: str = "Invalid holiday calendar state") -> None:
        super().__init__(message)


class InvalidLeaveTypeState(ConflictException):
    def __init__(self, message: str = "Invalid leave type state") -> None:
        super().__init__(message)


class InvalidLeaveBalanceState(ConflictException):
    def __init__(self, message: str = "Invalid leave balance state") -> None:
        super().__init__(message)


class InvalidLeaveRequestState(ConflictException):
    def __init__(self, message: str = "Invalid leave request state") -> None:
        super().__init__(message)


class InvalidLeaveAdjustmentState(ConflictException):
    def __init__(self, message: str = "Invalid leave adjustment state") -> None:
        super().__init__(message)


class InvalidAttendanceState(ConflictException):
    def __init__(self, message: str = "Invalid attendance state") -> None:
        super().__init__(message)


class InvalidEmployeeDocumentState(ConflictException):
    def __init__(self, message: str = "Invalid employee document state") -> None:
        super().__init__(message)


class InvalidPerformanceReviewState(ConflictException):
    def __init__(self, message: str = "Invalid performance review state") -> None:
        super().__init__(message)


class InvalidGoalState(ConflictException):
    def __init__(self, message: str = "Invalid goal state") -> None:
        super().__init__(message)


class InvalidAppraisalState(ConflictException):
    def __init__(self, message: str = "Invalid appraisal state") -> None:
        super().__init__(message)


class InvalidTrainingState(ConflictException):
    def __init__(self, message: str = "Invalid training state") -> None:
        super().__init__(message)


class InvalidTrainingAttendanceState(ConflictException):
    def __init__(self, message: str = "Invalid training attendance state") -> None:
        super().__init__(message)


class InvalidSeparationState(ConflictException):
    def __init__(self, message: str = "Invalid separation state") -> None:
        super().__init__(message)


class HrIdentitySyncError(ConflictException):
    def __init__(self, message: str = "HR identity sync failed") -> None:
        super().__init__(message)
