"""Marketing API routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.marketing.dependencies import (
    PaginationParams,
    TenantContext,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.marketing.schemas import (
    AnalyticsOverviewResponse,
    BrandVoiceCreate,
    BrandVoiceResponse,
    BrandVoiceSourceCreate,
    BrandVoiceSourceResponse,
    BrandVoiceUpdate,
    CalendarEntryCreate,
    CalendarEntryResponse,
    CalendarEntryUpdate,
    CampaignCreate,
    CampaignResponse,
    CampaignUpdate,
    CompetitorCreate,
    CompetitorResponse,
    CompetitorUpdate,
    ContentRequestCreate,
    ContentRequestResponse,
    ContentVersionResponse,
    GeneratedContentResponse,
    GeneratedContentUpdate,
    PillarCreate,
    PillarResponse,
    PillarUpdate,
    PlatformCreate,
    PlatformResponse,
    PlatformUpdate,
    PublishJobCreate,
    PublishJobResponse,
    ResearchCreate,
    ResearchResponse,
    SocialAccountCreate,
    SocialAccountResponse,
    SocialAccountUpdate,
    TrendCreate,
    TrendResponse,
)
from modules.marketing.service.campaign_service import CampaignService
from modules.marketing.service.catalog_service import (
    AnalyticsService,
    BrandVoiceService,
    CalendarService,
    CompetitorService,
    PillarService,
    PlatformService,
    PublishService,
    ResearchService,
    SocialAccountService,
    TrendService,
)
from modules.marketing.service.content_service import ContentService
from shared.schemas import APIResponse

platforms_router = APIRouter(prefix="/platforms", tags=["Marketing - Platforms"])
campaigns_router = APIRouter(prefix="/campaigns", tags=["Marketing - Campaigns"])
pillars_router = APIRouter(prefix="/pillars", tags=["Marketing - Pillars"])
brand_voices_router = APIRouter(prefix="/brand-voices", tags=["Marketing - Brand Voice"])
social_accounts_router = APIRouter(prefix="/social-accounts", tags=["Marketing - Social Accounts"])
content_requests_router = APIRouter(prefix="/content-requests", tags=["Marketing - Content Requests"])
content_router = APIRouter(prefix="/content", tags=["Marketing - Content"])
research_router = APIRouter(prefix="/research", tags=["Marketing - Research"])
trends_router = APIRouter(prefix="/trends", tags=["Marketing - Trends"])
competitors_router = APIRouter(prefix="/competitors", tags=["Marketing - Competitors"])
calendar_router = APIRouter(prefix="/calendar", tags=["Marketing - Calendar"])
publish_router = APIRouter(prefix="/publish-jobs", tags=["Marketing - Publish"])
analytics_router = APIRouter(prefix="/analytics", tags=["Marketing - Analytics"])


@platforms_router.get("", response_model=APIResponse[list[PlatformResponse]])
def list_platforms(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.platform:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PlatformService(db).list(ctx, company_id), pagination))


@platforms_router.post("", response_model=APIResponse[PlatformResponse])
def create_platform(
    body: PlatformCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.platform:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PlatformService(db).create(ctx, **body.model_dump()))


@platforms_router.patch("/{platform_id}", response_model=APIResponse[PlatformResponse])
def update_platform(
    platform_id: UUID,
    body: PlatformUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.platform:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=PlatformService(db).update(ctx, platform_id, **extract_update_fields(body)),
    )


@campaigns_router.get("", response_model=APIResponse[list[CampaignResponse]])
def list_campaigns(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(CampaignService(db).list(ctx, company_id), pagination))


@campaigns_router.post("", response_model=APIResponse[CampaignResponse])
def create_campaign(
    body: CampaignCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CampaignService(db).create(ctx, **body.model_dump()))


@campaigns_router.get("/{campaign_id}", response_model=APIResponse[CampaignResponse])
def get_campaign(
    campaign_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CampaignService(db).get(ctx, campaign_id))


@campaigns_router.patch("/{campaign_id}", response_model=APIResponse[CampaignResponse])
def update_campaign(
    campaign_id: UUID,
    body: CampaignUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=CampaignService(db).update(ctx, campaign_id, **extract_update_fields(body)),
    )


@campaigns_router.post("/{campaign_id}/activate", response_model=APIResponse[CampaignResponse])
def activate_campaign(
    campaign_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CampaignService(db).activate(ctx, campaign_id))


@pillars_router.get("", response_model=APIResponse[list[PillarResponse]])
def list_pillars(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.pillar:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PillarService(db).list(ctx, company_id), pagination))


@pillars_router.post("", response_model=APIResponse[PillarResponse])
def create_pillar(
    body: PillarCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.pillar:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PillarService(db).create(ctx, **body.model_dump()))


@pillars_router.patch("/{pillar_id}", response_model=APIResponse[PillarResponse])
def update_pillar(
    pillar_id: UUID,
    body: PillarUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.pillar:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PillarService(db).update(ctx, pillar_id, **extract_update_fields(body)))


@brand_voices_router.get("", response_model=APIResponse[list[BrandVoiceResponse]])
def list_brand_voices(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.brand_voice:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(BrandVoiceService(db).list(ctx, company_id), pagination))


@brand_voices_router.post("", response_model=APIResponse[BrandVoiceResponse])
def create_brand_voice(
    body: BrandVoiceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.brand_voice:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=BrandVoiceService(db).create(ctx, **body.model_dump()))


@brand_voices_router.patch("/{voice_id}", response_model=APIResponse[BrandVoiceResponse])
def update_brand_voice(
    voice_id: UUID,
    body: BrandVoiceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.brand_voice:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=BrandVoiceService(db).update(ctx, voice_id, **extract_update_fields(body)),
    )


@brand_voices_router.post("/{voice_id}/activate", response_model=APIResponse[BrandVoiceResponse])
def activate_brand_voice(
    voice_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.brand_voice:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=BrandVoiceService(db).activate(ctx, voice_id))


@brand_voices_router.get("/{voice_id}/sources", response_model=APIResponse[list[BrandVoiceSourceResponse]])
def list_brand_voice_sources(
    voice_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.brand_voice:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=BrandVoiceService(db).list_sources(ctx, voice_id))


@brand_voices_router.post("/{voice_id}/sources", response_model=APIResponse[BrandVoiceSourceResponse])
def add_brand_voice_source(
    voice_id: UUID,
    body: BrandVoiceSourceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.brand_voice:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=BrandVoiceService(db).add_source(ctx, voice_id, **body.model_dump()))


@social_accounts_router.get("", response_model=APIResponse[list[SocialAccountResponse]])
def list_social_accounts(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.social_account:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(SocialAccountService(db).list(ctx, company_id), pagination))


@social_accounts_router.post("", response_model=APIResponse[SocialAccountResponse])
def create_social_account(
    body: SocialAccountCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.social_account:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SocialAccountService(db).create(ctx, **body.model_dump()))


@social_accounts_router.patch("/{account_id}", response_model=APIResponse[SocialAccountResponse])
def update_social_account(
    account_id: UUID,
    body: SocialAccountUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.social_account:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=SocialAccountService(db).update(ctx, account_id, **extract_update_fields(body)),
    )


@content_requests_router.get("", response_model=APIResponse[list[ContentRequestResponse]])
def list_content_requests(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ContentService(db).list_requests(ctx, company_id), pagination))


@content_requests_router.post("", response_model=APIResponse[ContentRequestResponse])
def create_content_request(
    body: ContentRequestCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump()
    generate_now = payload.pop("generate_now", True)
    return APIResponse(
        message="OK",
        data=ContentService(db).create_request(ctx, generate_now=generate_now, **payload),
    )


@content_requests_router.get("/{request_id}", response_model=APIResponse[ContentRequestResponse])
def get_content_request(
    request_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ContentService(db).get_request(ctx, request_id))


@content_requests_router.post("/{request_id}/generate", response_model=APIResponse[ContentRequestResponse])
def generate_content_request(
    request_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:generate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ContentService(db).enqueue_generation(ctx, request_id))


@content_router.get("", response_model=APIResponse[list[GeneratedContentResponse]])
def list_content(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ContentService(db).list_content(ctx, company_id), pagination))


@content_router.get("/{content_id}", response_model=APIResponse[GeneratedContentResponse])
def get_content(
    content_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ContentService(db).get_content(ctx, content_id))


@content_router.patch("/{content_id}", response_model=APIResponse[GeneratedContentResponse])
def update_content(
    content_id: UUID,
    body: GeneratedContentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=ContentService(db).update_content(ctx, content_id, **extract_update_fields(body)),
    )


@content_router.post("/{content_id}/submit", response_model=APIResponse[GeneratedContentResponse])
def submit_content(
    content_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ContentService(db).submit_for_review(ctx, content_id))


@content_router.post("/{content_id}/approve", response_model=APIResponse[GeneratedContentResponse])
def approve_content(
    content_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ContentService(db).approve(ctx, content_id))


@content_router.get("/{content_id}/versions", response_model=APIResponse[list[ContentVersionResponse]])
def list_content_versions(
    content_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ContentService(db).list_versions(ctx, content_id))


@research_router.get("", response_model=APIResponse[list[ResearchResponse]])
def list_research(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.research:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ResearchService(db).list(ctx, company_id), pagination))


@research_router.post("", response_model=APIResponse[ResearchResponse])
def create_research(
    body: ResearchCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.research:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ResearchService(db).create(ctx, **body.model_dump()))


@trends_router.get("", response_model=APIResponse[list[TrendResponse]])
def list_trends(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.trend:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(TrendService(db).list(ctx, company_id), pagination))


@trends_router.post("", response_model=APIResponse[TrendResponse])
def create_trend(
    body: TrendCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.trend:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TrendService(db).create(ctx, **body.model_dump()))


@competitors_router.get("", response_model=APIResponse[list[CompetitorResponse]])
def list_competitors(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.competitor:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(CompetitorService(db).list(ctx, company_id), pagination))


@competitors_router.post("", response_model=APIResponse[CompetitorResponse])
def create_competitor(
    body: CompetitorCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.competitor:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CompetitorService(db).create(ctx, **body.model_dump()))


@competitors_router.patch("/{competitor_id}", response_model=APIResponse[CompetitorResponse])
def update_competitor(
    competitor_id: UUID,
    body: CompetitorUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.competitor:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=CompetitorService(db).update(ctx, competitor_id, **extract_update_fields(body)),
    )


@calendar_router.get("", response_model=APIResponse[list[CalendarEntryResponse]])
def list_calendar(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.calendar:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(CalendarService(db).list(ctx, company_id), pagination))


@calendar_router.post("", response_model=APIResponse[CalendarEntryResponse])
def create_calendar_entry(
    body: CalendarEntryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.calendar:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CalendarService(db).create(ctx, **body.model_dump()))


@calendar_router.patch("/{entry_id}", response_model=APIResponse[CalendarEntryResponse])
def update_calendar_entry(
    entry_id: UUID,
    body: CalendarEntryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.calendar:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=CalendarService(db).update(ctx, entry_id, **extract_update_fields(body)),
    )


@publish_router.get("", response_model=APIResponse[list[PublishJobResponse]])
def list_publish_jobs(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.publish:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PublishService(db).list(ctx, company_id), pagination))


@publish_router.post("", response_model=APIResponse[PublishJobResponse])
def create_publish_job(
    body: PublishJobCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.publish:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PublishService(db).create(ctx, **body.model_dump()))


@publish_router.post("/{job_id}/queue", response_model=APIResponse[PublishJobResponse])
def queue_publish_job(
    job_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.publish:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PublishService(db).queue(ctx, job_id))


@analytics_router.get("/overview", response_model=APIResponse[AnalyticsOverviewResponse])
def analytics_overview(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.analytics:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=AnalyticsService(db).overview(ctx, company_id))
