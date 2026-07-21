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
from modules.crm.service.approval_task_service import ApprovalTaskService
from modules.crm.service.attachment_service import AttachmentService
from modules.crm.service.blueprint_service import OpportunityBlueprintService
from modules.crm.service.campaign_service import CampaignService
from modules.crm.service.company_service import CompanyService
from modules.crm.service.contact_service import ContactService
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
from modules.crm.service.ovf_service import OvfService
from modules.crm.service.product_service import ProductService
from modules.crm.service.quote_service import QuoteService
from modules.crm.service.report_service import CRMReportService

__all__ = [
    "ApprovalTaskService",
    "AttachmentService",
    "CRMApplicationService",
    "CRMIntegrationService",
    "CRMReportService",
    "CallLogService",
    "CampaignService",
    "CompanyService",
    "ContactService",
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
    "OpportunityBlueprintService",
    "OpportunityService",
    "OpportunityStageService",
    "OvfService",
    "PipelineService",
    "ProductService",
    "QuoteService",
    "TaskService",
    "VisitLogService",
]
