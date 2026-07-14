"""CRM ORM models."""

from modules.crm.models.call_log import CrmCallLog
from modules.crm.models.campaign import CrmCampaign
from modules.crm.models.campaign_member import CrmCampaignMember
from modules.crm.models.customer_feedback import CrmCustomerFeedback
from modules.crm.models.customer_satisfaction import CrmCustomerSatisfaction
from modules.crm.models.email_log import CrmEmailLog
from modules.crm.models.followup import CrmFollowup
from modules.crm.models.interaction import CrmInteraction
from modules.crm.models.lead import CrmLead
from modules.crm.models.lead_activity import CrmLeadActivity
from modules.crm.models.lead_assignment import CrmLeadAssignment
from modules.crm.models.lead_source import CrmLeadSource
from modules.crm.models.meeting import CrmMeeting
from modules.crm.models.opportunity import CrmOpportunity
from modules.crm.models.opportunity_stage import CrmOpportunityStage
from modules.crm.models.pipeline import CrmPipeline
from modules.crm.models.task import CrmTask
from modules.crm.models.visit_log import CrmVisitLog

__all__ = [
    "CrmCallLog",
    "CrmCampaign",
    "CrmCampaignMember",
    "CrmCustomerFeedback",
    "CrmCustomerSatisfaction",
    "CrmEmailLog",
    "CrmFollowup",
    "CrmInteraction",
    "CrmLead",
    "CrmLeadActivity",
    "CrmLeadAssignment",
    "CrmLeadSource",
    "CrmMeeting",
    "CrmOpportunity",
    "CrmOpportunityStage",
    "CrmPipeline",
    "CrmTask",
    "CrmVisitLog",
]
