"""Helpdesk business engines."""

from modules.helpdesk.service.engines.customer_feedback_engine import CustomerFeedbackEngine
from modules.helpdesk.service.engines.knowledge_article_engine import KnowledgeArticleEngine
from modules.helpdesk.service.engines.knowledge_base_engine import KnowledgeBaseEngine
from modules.helpdesk.service.engines.resolution_engine import ResolutionEngine
from modules.helpdesk.service.engines.support_schedule_engine import SupportScheduleEngine
from modules.helpdesk.service.engines.support_shift_engine import SupportShiftEngine
from modules.helpdesk.service.engines.support_team_engine import SupportTeamEngine
from modules.helpdesk.service.engines.ticket_activity_engine import TicketActivityEngine
from modules.helpdesk.service.engines.ticket_assignment_engine import TicketAssignmentEngine
from modules.helpdesk.service.engines.ticket_attachment_engine import TicketAttachmentEngine
from modules.helpdesk.service.engines.ticket_category_engine import TicketCategoryEngine
from modules.helpdesk.service.engines.ticket_comment_engine import TicketCommentEngine
from modules.helpdesk.service.engines.ticket_dashboard_engine import TicketDashboardEngine
from modules.helpdesk.service.engines.ticket_engine import TicketEngine
from modules.helpdesk.service.engines.ticket_escalation_engine import TicketEscalationEngine
from modules.helpdesk.service.engines.ticket_notification_engine import TicketNotificationEngine
from modules.helpdesk.service.engines.ticket_priority_engine import TicketPriorityEngine
from modules.helpdesk.service.engines.ticket_report_engine import TicketReportEngine
from modules.helpdesk.service.engines.ticket_sla_engine import TicketSlaEngine
from modules.helpdesk.service.engines.ticket_status_history_engine import TicketStatusHistoryEngine

__all__ = [
    "TicketCategoryEngine",
    "TicketPriorityEngine",
    "TicketEngine",
    "TicketAssignmentEngine",
    "TicketStatusHistoryEngine",
    "TicketCommentEngine",
    "TicketAttachmentEngine",
    "TicketActivityEngine",
    "TicketSlaEngine",
    "TicketEscalationEngine",
    "KnowledgeBaseEngine",
    "KnowledgeArticleEngine",
    "ResolutionEngine",
    "CustomerFeedbackEngine",
    "SupportTeamEngine",
    "SupportShiftEngine",
    "SupportScheduleEngine",
    "TicketNotificationEngine",
    "TicketReportEngine",
    "TicketDashboardEngine",
]
