"""Resolution lifecycle engine."""

# ruff: noqa: F401
from modules.helpdesk.domain.enums import (
    CustomerFeedbackStatus,
    KnowledgeArticleStatus,
    KnowledgeBaseStatus,
    ResolutionStatus,
    SupportScheduleStatus,
    SupportShiftStatus,
    SupportTeamStatus,
    TicketActivityStatus,
    TicketAssignmentStatus,
    TicketAttachmentStatus,
    TicketCategoryStatus,
    TicketCommentStatus,
    TicketDashboardStatus,
    TicketEscalationStatus,
    TicketNotificationStatus,
    TicketPriorityStatus,
    TicketReportStatus,
    TicketSlaStatus,
    TicketStatus,
    TicketStatusHistoryStatus,
)
from modules.helpdesk.domain.exceptions import (
    InvalidCustomerFeedbackState,
    InvalidKnowledgeArticleState,
    InvalidKnowledgeBaseState,
    InvalidResolutionState,
    InvalidSupportScheduleState,
    InvalidSupportShiftState,
    InvalidSupportTeamState,
    InvalidTicketActivityState,
    InvalidTicketAssignmentState,
    InvalidTicketAttachmentState,
    InvalidTicketCategoryState,
    InvalidTicketCommentState,
    InvalidTicketDashboardState,
    InvalidTicketEscalationState,
    InvalidTicketNotificationState,
    InvalidTicketPriorityState,
    InvalidTicketReportState,
    InvalidTicketSlaState,
    InvalidTicketState,
    InvalidTicketStatusHistoryState,
)


class ResolutionEngine:
    def submit(self, row) -> None:
        if row.status != ResolutionStatus.DRAFT.value:
            raise InvalidResolutionState("Only draft resolutions can be submitted")
        row.status = ResolutionStatus.SUBMITTED.value

    def complete(self, row) -> None:
        if row.status != ResolutionStatus.SUBMITTED.value:
            raise InvalidResolutionState("Only submitted resolutions can complete")
        row.status = ResolutionStatus.COMPLETED.value

    def cancel(self, row) -> None:
        row.status = ResolutionStatus.CANCELLED.value
