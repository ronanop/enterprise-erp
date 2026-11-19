"""API v1 router aggregation — standalone HRMS."""

from fastapi import APIRouter

from modules.ess.router import ess_router
from modules.foundation.router import foundation_router
from modules.hr.router import hr_router
from modules.hr.routers.digital_onboarding import public_onboarding_router
from modules.master_data.router import master_data_router
from modules.organization.router import organization_router
from modules.payroll.router import payroll_router
from modules.platform.router import platform_router
from modules.recruitment.router import (
    public_bg_check_router,
    public_bg_vendor_router,
    public_careers_router,
    recruitment_router,
)
from shared.health import router as health_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router, tags=["Health"])
api_v1_router.include_router(foundation_router)
api_v1_router.include_router(platform_router)
api_v1_router.include_router(organization_router)
api_v1_router.include_router(master_data_router)
api_v1_router.include_router(hr_router)
api_v1_router.include_router(public_onboarding_router)
api_v1_router.include_router(ess_router)
api_v1_router.include_router(payroll_router)
api_v1_router.include_router(recruitment_router)
api_v1_router.include_router(public_careers_router)
api_v1_router.include_router(public_bg_check_router)
api_v1_router.include_router(public_bg_vendor_router)
