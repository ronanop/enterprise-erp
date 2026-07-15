"""TicketPriority lifecycle engine."""

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


class TicketPriorityEngine:
    def activate(self, row) -> None:
        row.status = TicketPriorityStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = TicketPriorityStatus.INACTIVE.value
