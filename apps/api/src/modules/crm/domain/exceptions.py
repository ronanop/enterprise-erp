"""CRM domain exceptions."""

from core.exceptions import ConflictException


class InvalidLeadState(ConflictException):
    def __init__(self, message: str = "Invalid lead state") -> None:
        super().__init__(message)


class InvalidOpportunityState(ConflictException):
    def __init__(self, message: str = "Invalid opportunity state") -> None:
        super().__init__(message)


class InvalidCampaignState(ConflictException):
    def __init__(self, message: str = "Invalid campaign state") -> None:
        super().__init__(message)


class InvalidTaskState(ConflictException):
    def __init__(self, message: str = "Invalid task state") -> None:
        super().__init__(message)


class InvalidMeetingState(ConflictException):
    def __init__(self, message: str = "Invalid meeting state") -> None:
        super().__init__(message)


class InvalidFollowupState(ConflictException):
    def __init__(self, message: str = "Invalid follow-up state") -> None:
        super().__init__(message)


class InvalidPipelineState(ConflictException):
    def __init__(self, message: str = "Invalid pipeline state") -> None:
        super().__init__(message)


class InvalidFeedbackState(ConflictException):
    def __init__(self, message: str = "Invalid feedback state") -> None:
        super().__init__(message)


class InvalidSatisfactionState(ConflictException):
    def __init__(self, message: str = "Invalid satisfaction state") -> None:
        super().__init__(message)


class InvalidAssignmentState(ConflictException):
    def __init__(self, message: str = "Invalid assignment state") -> None:
        super().__init__(message)


class InvalidCampaignMemberState(ConflictException):
    def __init__(self, message: str = "Invalid campaign member state") -> None:
        super().__init__(message)


class CrmConversionError(ConflictException):
    def __init__(self, message: str = "CRM conversion failed") -> None:
        super().__init__(message)


class InvalidBlueprintState(ConflictException):
    def __init__(self, message: str = "Invalid sales blueprint transition") -> None:
        super().__init__(message)


class RecordLocked(ConflictException):
    def __init__(self, message: str = "Record is locked pending approval") -> None:
        super().__init__(message)


class MarginBelowThreshold(ConflictException):
    def __init__(self, message: str = "Margin is at or below the required threshold") -> None:
        super().__init__(message)
