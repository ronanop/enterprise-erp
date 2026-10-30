"""Recruitment module router aggregation."""

from fastapi import APIRouter

from modules.recruitment.routers import (
    application_stages_router,
    applications_router,
    background_verifications_router,
    candidate_documents_router,
    candidate_notes_router,
    candidates_router,
    interview_feedback_router,
    interviews_router,
    job_postings_router,
    job_requisitions_router,
    lookups_router,
    offer_approvals_router,
    offers_router,
    onboarding_router,
    onboarding_tasks_router,
    recruiters_router,
    recruitment_sources_router,
    reference_checks_router,
    reports_router,
    resumes_router,
    talent_pools_router,
)
from modules.recruitment.routers.public_bg_check import public_bg_check_router
from modules.recruitment.routers.public_bg_vendor import public_bg_vendor_router
from modules.recruitment.routers.public_careers import public_careers_router
from modules.recruitment.routers.recruitment_email import recruitment_email_router

__all__ = [
    "recruitment_router",
    "public_careers_router",
    "public_bg_check_router",
    "public_bg_vendor_router",
]

recruitment_router = APIRouter(prefix="/recruitment")
recruitment_router.include_router(lookups_router)
recruitment_router.include_router(job_requisitions_router)
recruitment_router.include_router(job_postings_router)
recruitment_router.include_router(recruitment_sources_router)
recruitment_router.include_router(recruiters_router)
recruitment_router.include_router(candidates_router)
recruitment_router.include_router(candidate_documents_router)
recruitment_router.include_router(resumes_router)
recruitment_router.include_router(applications_router)
recruitment_router.include_router(application_stages_router)
recruitment_router.include_router(interviews_router)
recruitment_router.include_router(interview_feedback_router)
recruitment_router.include_router(offers_router)
recruitment_router.include_router(offer_approvals_router)
recruitment_router.include_router(background_verifications_router)
recruitment_router.include_router(reference_checks_router)
recruitment_router.include_router(talent_pools_router)
recruitment_router.include_router(candidate_notes_router)
recruitment_router.include_router(onboarding_router)
recruitment_router.include_router(onboarding_tasks_router)
recruitment_router.include_router(reports_router)
recruitment_router.include_router(recruitment_email_router)
