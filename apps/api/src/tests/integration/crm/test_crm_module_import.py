"""Integration smoke: CRM module imports and router mount."""

from modules.crm.models import CrmCampaign, CrmLead, CrmOpportunity
from modules.crm.router import crm_router
from modules.crm.service import CRMApplicationService, LeadService, OpportunityService
from modules.crm.service.engines import LeadEngine, OpportunityEngine


def test_crm_models_importable():
    assert CrmLead.__tablename__ == "crm_lead"
    assert CrmOpportunity.__tablename__ == "crm_opportunity"
    assert CrmCampaign.__tablename__ == "crm_campaign"


def test_crm_router_mounted():
    assert crm_router.prefix == "/crm"
    assert len(crm_router.routes) > 20


def test_crm_services_and_engines_importable():
    assert LeadService is not None
    assert OpportunityService is not None
    assert CRMApplicationService is not None
    assert LeadEngine is not None
    assert OpportunityEngine is not None
