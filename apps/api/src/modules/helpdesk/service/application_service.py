"""Helpdesk application service facade."""

from sqlalchemy.orm import Session

from modules.helpdesk.service.customer_feedback_service import CustomerFeedbackService
from modules.helpdesk.service.helpdesk_dashboard_service import HelpdeskDashboardService
from modules.helpdesk.service.helpdesk_report_service import HelpdeskReportService
from modules.helpdesk.service.integration_service import HelpdeskIntegrationService
from modules.helpdesk.service.knowledge_article_service import KnowledgeArticleService
from modules.helpdesk.service.knowledge_base_service import KnowledgeBaseService
from modules.helpdesk.service.resolution_service import ResolutionService
from modules.helpdesk.service.support_schedule_service import SupportScheduleService
from modules.helpdesk.service.support_shift_service import SupportShiftService
from modules.helpdesk.service.support_team_service import SupportTeamService
from modules.helpdesk.service.ticket_activity_service import TicketActivityService
from modules.helpdesk.service.ticket_assignment_service import TicketAssignmentService
from modules.helpdesk.service.ticket_attachment_service import TicketAttachmentService
from modules.helpdesk.service.ticket_category_service import TicketCategoryService
from modules.helpdesk.service.ticket_comment_service import TicketCommentService
from modules.helpdesk.service.ticket_escalation_service import TicketEscalationService
from modules.helpdesk.service.ticket_notification_service import TicketNotificationService
from modules.helpdesk.service.ticket_priority_service import TicketPriorityService
from modules.helpdesk.service.ticket_service import TicketService
from modules.helpdesk.service.ticket_sla_service import TicketSlaService
from modules.helpdesk.service.ticket_status_history_service import TicketStatusHistoryService


class HelpdeskApplicationService:
    def __init__(self, db: Session) -> None:
        self.categories = TicketCategoryService(db)
        self.priorities = TicketPriorityService(db)
        self.tickets = TicketService(db)
        self.assignments = TicketAssignmentService(db)
        self.status_history = TicketStatusHistoryService(db)
        self.comments = TicketCommentService(db)
        self.attachments = TicketAttachmentService(db)
        self.activities = TicketActivityService(db)
        self.slas = TicketSlaService(db)
        self.escalations = TicketEscalationService(db)
        self.knowledge_bases = KnowledgeBaseService(db)
        self.knowledge_articles = KnowledgeArticleService(db)
        self.resolutions = ResolutionService(db)
        self.feedback = CustomerFeedbackService(db)
        self.teams = SupportTeamService(db)
        self.shifts = SupportShiftService(db)
        self.schedules = SupportScheduleService(db)
        self.notifications = TicketNotificationService(db)
        self.reports = HelpdeskReportService(db)
        self.dashboards = HelpdeskDashboardService(db)
        self.integration = HelpdeskIntegrationService(db)
