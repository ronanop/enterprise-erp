"""SupportSchedule lifecycle engine."""

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


class SupportScheduleEngine:
    def confirm(self, row) -> None:
        if row.status != SupportScheduleStatus.PLANNED.value:
            raise InvalidSupportScheduleState("Only planned schedules can confirm")
        row.status = SupportScheduleStatus.CONFIRMED.value

    def complete(self, row) -> None:
        if row.status not in {
            SupportScheduleStatus.PLANNED.value,
            SupportScheduleStatus.CONFIRMED.value,
        }:
            raise InvalidSupportScheduleState("Schedule not completable")
        row.status = SupportScheduleStatus.COMPLETED.value

    def cancel(self, row) -> None:
        row.status = SupportScheduleStatus.CANCELLED.value
