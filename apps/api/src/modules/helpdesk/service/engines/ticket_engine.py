"""Ticket lifecycle engine."""

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


class TicketEngine:
    def submit(self, row) -> None:
        if row.status != TicketStatus.DRAFT.value:
            raise InvalidTicketState("Only draft tickets can be submitted")
        if not row.customer_id and not row.requester_employee_id:
            raise InvalidTicketState("Ticket requires customer_id or requester_employee_id")
        row.status = TicketStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != TicketStatus.SUBMITTED.value:
            raise InvalidTicketState("Only submitted tickets can be approved")
        row.status = TicketStatus.APPROVED.value

    def activate(self, row) -> None:
        if row.status != TicketStatus.APPROVED.value:
            raise InvalidTicketState("Only approved tickets can become new")
        row.status = TicketStatus.NEW.value

    def assign(self, row) -> None:
        if row.status not in {TicketStatus.APPROVED.value, TicketStatus.NEW.value}:
            raise InvalidTicketState("Ticket not assignable")
        row.status = TicketStatus.ASSIGNED.value

    def start(self, row) -> None:
        if row.status not in {TicketStatus.ASSIGNED.value, TicketStatus.PENDING.value}:
            raise InvalidTicketState("Ticket not startable")
        row.status = TicketStatus.IN_PROGRESS.value

    def resolve(self, row) -> None:
        if row.status != TicketStatus.IN_PROGRESS.value:
            raise InvalidTicketState("Only in-progress tickets can resolve")
        row.status = TicketStatus.RESOLVED.value

    def close(self, row) -> None:
        if row.status != TicketStatus.RESOLVED.value:
            raise InvalidTicketState("Only resolved tickets can close")
        row.status = TicketStatus.CLOSED.value

    def cancel(self, row) -> None:
        if row.status in {TicketStatus.CLOSED.value, TicketStatus.CANCELLED.value}:
            raise InvalidTicketState("Ticket already terminal")
        row.status = TicketStatus.CANCELLED.value
