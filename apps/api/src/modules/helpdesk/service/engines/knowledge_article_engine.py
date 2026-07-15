"""KnowledgeArticle lifecycle engine."""

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


class KnowledgeArticleEngine:
    def submit(self, row) -> None:
        if row.status != KnowledgeArticleStatus.DRAFT.value:
            raise InvalidKnowledgeArticleState("Only draft articles can be submitted")
        row.status = KnowledgeArticleStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != KnowledgeArticleStatus.SUBMITTED.value:
            raise InvalidKnowledgeArticleState("Only submitted articles can be approved")
        row.status = KnowledgeArticleStatus.APPROVED.value

    def publish(self, row) -> None:
        if row.status != KnowledgeArticleStatus.APPROVED.value:
            raise InvalidKnowledgeArticleState("Only approved articles can be published")
        row.status = KnowledgeArticleStatus.PUBLISHED.value

    def archive(self, row) -> None:
        row.status = KnowledgeArticleStatus.ARCHIVED.value

    def cancel(self, row) -> None:
        row.status = KnowledgeArticleStatus.CANCELLED.value
