"""Helpdesk ORM models."""

from modules.helpdesk.models.customer_feedback import HdCustomerFeedback
from modules.helpdesk.models.knowledge_article import HdKnowledgeArticle
from modules.helpdesk.models.knowledge_base import HdKnowledgeBase
from modules.helpdesk.models.resolution import HdResolution
from modules.helpdesk.models.support_schedule import HdSupportSchedule
from modules.helpdesk.models.support_shift import HdSupportShift
from modules.helpdesk.models.support_team import HdSupportTeam
from modules.helpdesk.models.ticket import HdTicket
from modules.helpdesk.models.ticket_activity import HdTicketActivity
from modules.helpdesk.models.ticket_assignment import HdTicketAssignment
from modules.helpdesk.models.ticket_attachment import HdTicketAttachment
from modules.helpdesk.models.ticket_category import HdTicketCategory
from modules.helpdesk.models.ticket_comment import HdTicketComment
from modules.helpdesk.models.ticket_dashboard import HdTicketDashboard
from modules.helpdesk.models.ticket_escalation import HdTicketEscalation
from modules.helpdesk.models.ticket_notification import HdTicketNotification
from modules.helpdesk.models.ticket_priority import HdTicketPriority
from modules.helpdesk.models.ticket_report import HdTicketReport
from modules.helpdesk.models.ticket_sla import HdTicketSla
from modules.helpdesk.models.ticket_status_history import HdTicketStatusHistory

__all__ = [
    "HdTicketCategory",
    "HdTicketPriority",
    "HdTicket",
    "HdTicketAssignment",
    "HdTicketStatusHistory",
    "HdTicketComment",
    "HdTicketAttachment",
    "HdTicketActivity",
    "HdTicketSla",
    "HdTicketEscalation",
    "HdKnowledgeBase",
    "HdKnowledgeArticle",
    "HdResolution",
    "HdCustomerFeedback",
    "HdSupportTeam",
    "HdSupportShift",
    "HdSupportSchedule",
    "HdTicketNotification",
    "HdTicketReport",
    "HdTicketDashboard",
]
