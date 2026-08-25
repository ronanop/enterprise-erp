"""Marketing module router aggregation."""

from fastapi import APIRouter

from modules.marketing.routers import (
    analytics_router,
    brand_voices_router,
    calendar_router,
    campaigns_router,
    competitors_router,
    content_requests_router,
    content_router,
    pillars_router,
    platforms_router,
    publish_router,
    research_router,
    social_accounts_router,
    trends_router,
)
from modules.marketing.routers.ops import (
    ai_ops_router,
    approvals_router,
    m365_router,
    ops_router,
    tasks_router,
    workload_router,
)

marketing_router = APIRouter(prefix="/marketing")
marketing_router.include_router(platforms_router)
marketing_router.include_router(campaigns_router)
marketing_router.include_router(pillars_router)
marketing_router.include_router(brand_voices_router)
marketing_router.include_router(social_accounts_router)
marketing_router.include_router(content_requests_router)
marketing_router.include_router(content_router)
marketing_router.include_router(research_router)
marketing_router.include_router(trends_router)
marketing_router.include_router(competitors_router)
marketing_router.include_router(calendar_router)
marketing_router.include_router(publish_router)
marketing_router.include_router(analytics_router)
marketing_router.include_router(tasks_router)
marketing_router.include_router(approvals_router)
marketing_router.include_router(m365_router)
marketing_router.include_router(workload_router)
marketing_router.include_router(ops_router)
marketing_router.include_router(ai_ops_router)
