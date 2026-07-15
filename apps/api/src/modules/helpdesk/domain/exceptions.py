"""Helpdesk domain exceptions."""

from core.exceptions import ConflictException


class InvalidTicketCategoryState(ConflictException):
    def __init__(self, message: str = "Invalid ticketcategory state") -> None:
        super().__init__(message)


class InvalidTicketPriorityState(ConflictException):
    def __init__(self, message: str = "Invalid ticketpriority state") -> None:
        super().__init__(message)


class InvalidTicketState(ConflictException):
    def __init__(self, message: str = "Invalid ticket state") -> None:
        super().__init__(message)


class InvalidTicketAssignmentState(ConflictException):
    def __init__(self, message: str = "Invalid ticketassignment state") -> None:
        super().__init__(message)


class InvalidTicketStatusHistoryState(ConflictException):
    def __init__(self, message: str = "Invalid ticketstatushistory state") -> None:
        super().__init__(message)


class InvalidTicketCommentState(ConflictException):
    def __init__(self, message: str = "Invalid ticketcomment state") -> None:
        super().__init__(message)


class InvalidTicketAttachmentState(ConflictException):
    def __init__(self, message: str = "Invalid ticketattachment state") -> None:
        super().__init__(message)


class InvalidTicketActivityState(ConflictException):
    def __init__(self, message: str = "Invalid ticketactivity state") -> None:
        super().__init__(message)


class InvalidTicketSlaState(ConflictException):
    def __init__(self, message: str = "Invalid ticketsla state") -> None:
        super().__init__(message)


class InvalidTicketEscalationState(ConflictException):
    def __init__(self, message: str = "Invalid ticketescalation state") -> None:
        super().__init__(message)


class InvalidKnowledgeBaseState(ConflictException):
    def __init__(self, message: str = "Invalid knowledgebase state") -> None:
        super().__init__(message)


class InvalidKnowledgeArticleState(ConflictException):
    def __init__(self, message: str = "Invalid knowledgearticle state") -> None:
        super().__init__(message)


class InvalidResolutionState(ConflictException):
    def __init__(self, message: str = "Invalid resolution state") -> None:
        super().__init__(message)


class InvalidCustomerFeedbackState(ConflictException):
    def __init__(self, message: str = "Invalid customerfeedback state") -> None:
        super().__init__(message)


class InvalidSupportTeamState(ConflictException):
    def __init__(self, message: str = "Invalid supportteam state") -> None:
        super().__init__(message)


class InvalidSupportShiftState(ConflictException):
    def __init__(self, message: str = "Invalid supportshift state") -> None:
        super().__init__(message)


class InvalidSupportScheduleState(ConflictException):
    def __init__(self, message: str = "Invalid supportschedule state") -> None:
        super().__init__(message)


class InvalidTicketNotificationState(ConflictException):
    def __init__(self, message: str = "Invalid ticketnotification state") -> None:
        super().__init__(message)


class InvalidTicketReportState(ConflictException):
    def __init__(self, message: str = "Invalid ticketreport state") -> None:
        super().__init__(message)


class InvalidTicketDashboardState(ConflictException):
    def __init__(self, message: str = "Invalid ticketdashboard state") -> None:
        super().__init__(message)
