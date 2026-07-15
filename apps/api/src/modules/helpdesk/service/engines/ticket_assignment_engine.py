"""TicketAssignment lifecycle engine."""

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


class TicketAssignmentEngine:
    def submit(self, row) -> None:
        if row.status != TicketAssignmentStatus.DRAFT.value:
            raise InvalidTicketAssignmentState("Only draft assignments can be submitted")
        row.status = TicketAssignmentStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != TicketAssignmentStatus.SUBMITTED.value:
            raise InvalidTicketAssignmentState("Only submitted assignments can be approved")
        row.status = TicketAssignmentStatus.APPROVED.value

    def activate(self, row) -> None:
        if row.status != TicketAssignmentStatus.APPROVED.value:
            raise InvalidTicketAssignmentState("Only approved assignments can activate")
        row.status = TicketAssignmentStatus.ACTIVE.value

    def complete(self, row) -> None:
        if row.status != TicketAssignmentStatus.ACTIVE.value:
            raise InvalidTicketAssignmentState("Only active assignments can complete")
        row.status = TicketAssignmentStatus.COMPLETED.value

    def cancel(self, row) -> None:
        row.status = TicketAssignmentStatus.CANCELLED.value
