"""API v1 router aggregation."""

from fastapi import APIRouter

from modules.finance.router import finance_router
from modules.foundation.router import foundation_router
from modules.inventory.router import inventory_router
from modules.manufacturing.router import manufacturing_router
from modules.master_data.router import master_data_router
from modules.organization.router import organization_router
from modules.procurement.router import procurement_router
from modules.quality.router import quality_router
from modules.sales.router import sales_router
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
