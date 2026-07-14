"""CRM services."""

from modules.crm.service.activity_service import (
    CallLogService,
    EmailLogService,
    FollowupService,
    InteractionService,
    MeetingService,
    TaskService,
    VisitLogService,
)
from modules.crm.service.application_service import CRMApplicationService
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

__all__ = [
    "CRMApplicationService",
    "CRMIntegrationService",
    "CRMReportService",
    "CallLogService",
    "CampaignService",
    "CustomerSatisfactionService",
    "EmailLogService",
    "FeedbackService",
    "FollowupService",
    "InteractionService",
    "LeadActivityService",
    "LeadAssignmentService",
    "LeadService",
    "LeadSourceService",
    "MeetingService",
    "OpportunityService",
    "OpportunityStageService",
    "PipelineService",
    "TaskService",
    "VisitLogService",
]
