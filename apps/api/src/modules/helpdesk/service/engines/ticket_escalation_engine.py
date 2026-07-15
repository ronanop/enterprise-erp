"""TicketEscalation lifecycle engine."""

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


class TicketEscalationEngine:
    def escalate(self, row) -> None:
        if row.status != TicketEscalationStatus.OPEN.value:
            raise InvalidTicketEscalationState("Only open escalations can escalate further")
        row.escalation_level = int(row.escalation_level or 1) + 1

    def acknowledge(self, row) -> None:
        if row.status != TicketEscalationStatus.OPEN.value:
            raise InvalidTicketEscalationState("Only open escalations can be acknowledged")
        row.status = TicketEscalationStatus.ACKNOWLEDGED.value

    def resolve(self, row) -> None:
        if row.status not in {
            TicketEscalationStatus.OPEN.value,
            TicketEscalationStatus.ACKNOWLEDGED.value,
        }:
            raise InvalidTicketEscalationState("Escalation not resolvable")
        row.status = TicketEscalationStatus.RESOLVED.value

    def cancel(self, row) -> None:
        row.status = TicketEscalationStatus.CANCELLED.value
