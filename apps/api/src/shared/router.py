"""API v1 router aggregation."""

from fastapi import APIRouter

from modules.analytics.router import analytics_router
from modules.asset.router import asset_router
from modules.crm.router import crm_router
from modules.document.router import document_router
from modules.finance.router import finance_router
from modules.foundation.router import foundation_router
from modules.grc.router import grc_router
from modules.helpdesk.router import helpdesk_router
from modules.hr.router import hr_router
from modules.inventory.router import inventory_router
from modules.manufacturing.router import manufacturing_router
from modules.master_data.router import master_data_router
from modules.organization.router import organization_router
from modules.payroll.router import payroll_router
from modules.procurement.router import procurement_router
from modules.project.router import project_router
from modules.quality.router import quality_router
from modules.recruitment.router import recruitment_router
from modules.sales.router import sales_router
from modules.service.router import service_router
from shared.health import router as health_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router, tags=["Health"])
api_v1_router.include_router(foundation_router)
api_v1_router.include_router(organization_router)
api_v1_router.include_router(master_data_router)
api_v1_router.include_router(finance_router)
api_v1_router.include_router(sales_router)
api_v1_router.include_router(procurement_router)
api_v1_router.include_router(inventory_router)
api_v1_router.include_router(manufacturing_router)
api_v1_router.include_router(quality_router)
api_v1_router.include_router(crm_router)
api_v1_router.include_router(hr_router)
api_v1_router.include_router(payroll_router)
api_v1_router.include_router(recruitment_router)
api_v1_router.include_router(project_router)
api_v1_router.include_router(asset_router)
api_v1_router.include_router(service_router)
api_v1_router.include_router(helpdesk_router)
api_v1_router.include_router(document_router)
api_v1_router.include_router(grc_router)
api_v1_router.include_router(analytics_router)
