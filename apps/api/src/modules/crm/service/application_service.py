"""CRM application service facade."""

from sqlalchemy.orm import Session

from modules.crm.service.activity_service import (
    CallLogService,
    EmailLogService,
    FollowupService,
    InteractionService,
    MeetingService,
    TaskService,
    VisitLogService,
)
from modules.crm.service.campaign_service import CampaignService
from modules.crm.service.feedback_service import CustomerSatisfactionService, FeedbackService
from modules.crm.service.integration_service import CRMIntegrationService
from modules.crm.service.lead_service import (
    LeadActivityService,
    LeadAssignmentService,
    LeadService,
    LeadSourceService,
)
from modules.crm.service.opportunity_service import (
    OpportunityService,
    OpportunityStageService,
    PipelineService,
)
from modules.crm.service.report_service import CRMReportService


class CRMApplicationService:
    def __init__(self, db: Session) -> None:
        self.leads = LeadService(db)
        self.lead_sources = LeadSourceService(db)
        self.lead_assignments = LeadAssignmentService(db)
        self.lead_activities = LeadActivityService(db)
        self.pipelines = PipelineService(db)
        self.opportunities = OpportunityService(db)
        self.opportunity_stages = OpportunityStageService(db)
        self.campaigns = CampaignService(db)
        self.interactions = InteractionService(db)
        self.tasks = TaskService(db)
        self.followups = FollowupService(db)
        self.meetings = MeetingService(db)
        self.call_logs = CallLogService(db)
        self.email_logs = EmailLogService(db)
        self.visit_logs = VisitLogService(db)
        self.feedback = FeedbackService(db)
        self.satisfaction = CustomerSatisfactionService(db)
        self.reports = CRMReportService(db)
        self.integration = CRMIntegrationService(db)
