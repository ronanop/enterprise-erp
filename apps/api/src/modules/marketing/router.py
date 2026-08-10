"""Marketing module router aggregation."""

from fastapi import APIRouter

from modules.marketing.routers.marketing import (
    assets_router,
    campaigns_router,
    channels_router,
    content_router,
    dashboard_router,
    pipeline_router,
    reports_router,
)

marketing_router = APIRouter(prefix="/marketing")
marketing_router.include_router(campaigns_router)
marketing_router.include_router(channels_router)
marketing_router.include_router(content_router)
marketing_router.include_router(assets_router)
marketing_router.include_router(dashboard_router)
marketing_router.include_router(pipeline_router)
marketing_router.include_router(reports_router)
