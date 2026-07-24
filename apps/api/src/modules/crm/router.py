"""CRM module router aggregation."""

from fastapi import APIRouter

from modules.crm.routers import (
    attachments_router,
    blueprint_router,
    call_logs_router,
    campaign_members_router,
    campaigns_router,
    companies_router,
    contacts_router,
    email_logs_router,
    feedback_router,
    followups_router,
    interactions_router,
    lead_activities_router,
    lead_assignments_router,
    lead_sources_router,
    leads_router,
    meetings_router,
    my_jobs_router,
    oems_router,
    opportunities_router,
    opportunity_stages_router,
    ovf_router,
    pipelines_router,
    products_router,
    quotes_router,
    reports_router,
    satisfaction_router,
    tasks_router,
    visit_logs_router,
)

crm_router = APIRouter(prefix="/crm")
crm_router.include_router(lead_sources_router)
crm_router.include_router(leads_router)
crm_router.include_router(lead_assignments_router)
crm_router.include_router(lead_activities_router)
crm_router.include_router(pipelines_router)
crm_router.include_router(opportunities_router)
crm_router.include_router(opportunity_stages_router)
crm_router.include_router(campaigns_router)
crm_router.include_router(campaign_members_router)
crm_router.include_router(interactions_router)
crm_router.include_router(tasks_router)
crm_router.include_router(followups_router)
crm_router.include_router(meetings_router)
crm_router.include_router(call_logs_router)
crm_router.include_router(email_logs_router)
crm_router.include_router(visit_logs_router)
crm_router.include_router(feedback_router)
crm_router.include_router(satisfaction_router)
crm_router.include_router(reports_router)

# --- Sales CRM (Zoho-replacement) additions ---
crm_router.include_router(companies_router)
crm_router.include_router(contacts_router)
crm_router.include_router(products_router)
crm_router.include_router(oems_router)
crm_router.include_router(quotes_router)
crm_router.include_router(ovf_router)
crm_router.include_router(my_jobs_router)
crm_router.include_router(attachments_router)
crm_router.include_router(blueprint_router)
