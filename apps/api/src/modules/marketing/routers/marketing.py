"""Marketing API routers."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from modules.marketing.dependencies import (
    PaginationParams,
    TenantContext,
    extract_update_fields,
    get_db,
    get_pagination,
    get_tenant_context,
    paginate,
    require_permission,
)
from modules.marketing.schemas import (
    ActivityLogResponse,
    ApprovalResponse,
    AssetUploadPayload,
    CalendarItem,
    CampaignAudienceCreate,
    CampaignAudienceResponse,
    CampaignCreate,
    CampaignResponse,
    CampaignUpdate,
    ChannelCreate,
    ChannelResponse,
    ChannelUpdate,
    ContentAssetLinkPayload,
    ContentAssignmentCreate,
    ContentAssignmentResponse,
    ContentCommentsPayload,
    ContentItemCreate,
    ContentItemResponse,
    ContentItemUpdate,
    ContentRejectPayload,
    ContentSchedulePayload,
    PostingReportPayload,
    DashboardStats,
    MediaAssetCreate,
    MediaAssetResponse,
    PipelineHeadReviewResponse,
    PipelineWorkResponse,
    PublicationCreate,
    PublicationResponse,
    ReportSummary,
    HeadReviewItemPayload,
    LinkedInHeadSectionReviewPayload,
    LinkedInHeadFinalDraftReviewPayload,
    LinkedInSubmitFinalDraftPayload,
    PostingTimelinePayload,
    PublisherUploadReportPayload,
    SendToPublisherPayload,
    VerificationItemUpdatePayload,
    VerificationSubmitItemPayload,
)
from modules.marketing.service.asset_service import MediaAssetService
from modules.marketing.service.campaign_service import CampaignService
from modules.marketing.service.channel_service import ChannelService
from modules.marketing.service.content_service import ContentItemService
from modules.marketing.service.dashboard_service import DashboardService
from modules.marketing.service.linkedin_section_service import LinkedInSectionService
from modules.marketing.service.pipeline_service import PipelineService
from modules.marketing.service.report_service import ReportService
from modules.marketing.service.verification_service import VerificationService
from shared.schemas import APIResponse

campaigns_router = APIRouter(prefix="/campaigns", tags=["Marketing — Campaigns"])
channels_router = APIRouter(prefix="/channels", tags=["Marketing — Channels"])
content_router = APIRouter(prefix="/content-items", tags=["Marketing — Content"])
assets_router = APIRouter(prefix="/assets", tags=["Marketing — Assets"])
dashboard_router = APIRouter(prefix="/dashboard", tags=["Marketing — Dashboard"])
pipeline_router = APIRouter(prefix="/pipeline", tags=["Marketing — Pipeline"])
reports_router = APIRouter(prefix="/reports", tags=["Marketing — Reports"])


@campaigns_router.get("", response_model=APIResponse[list[CampaignResponse]])
def list_campaigns(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    status: str | None = None,
    q: str | None = None,
):
    items = CampaignService(db).list_campaigns(ctx, company_id=company_id, status=status, q=q)
    return APIResponse(message="OK", data=paginate(items, pagination))


@campaigns_router.get("/{row_id}", response_model=APIResponse[CampaignResponse])
def get_campaign(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CampaignService(db).get_campaign(ctx, row_id))


@campaigns_router.post("", response_model=APIResponse[CampaignResponse])
def create_campaign(
    body: CampaignCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude_none=True)
    company_id = payload.pop("company_id", None)
    data = CampaignService(db).create_campaign(ctx, company_id=company_id, **payload)
    db.commit()
    return APIResponse(message="Campaign created", data=data)


@campaigns_router.patch("/{row_id}", response_model=APIResponse[CampaignResponse])
def update_campaign(
    row_id: UUID,
    body: CampaignUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CampaignService(db).update_campaign(ctx, row_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Campaign updated", data=data)


@campaigns_router.post("/{row_id}/submit", response_model=APIResponse[CampaignResponse])
def submit_campaign(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CampaignService(db).submit_campaign(ctx, row_id)
    db.commit()
    return APIResponse(message="Campaign submitted for head approval", data=data)


@campaigns_router.post("/{row_id}/approve", response_model=APIResponse[CampaignResponse])
def approve_campaign(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CampaignService(db).approve_campaign(ctx, row_id)
    db.commit()
    return APIResponse(message="Campaign approved", data=data)


@campaigns_router.post("/{row_id}/request-changes", response_model=APIResponse[CampaignResponse])
def request_campaign_changes(
    row_id: UUID,
    body: ContentRejectPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CampaignService(db).request_campaign_changes(ctx, row_id, body.reason)
    db.commit()
    return APIResponse(message="Changes requested", data=data)


@campaigns_router.post("/{row_id}/activate", response_model=APIResponse[CampaignResponse])
def activate_campaign(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:activate"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CampaignService(db).activate_campaign(ctx, row_id)
    db.commit()
    return APIResponse(message="Campaign activated", data=data)


@campaigns_router.post("/{row_id}/complete", response_model=APIResponse[CampaignResponse])
def complete_campaign(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CampaignService(db).complete_campaign(ctx, row_id)
    db.commit()
    return APIResponse(message="Campaign completed", data=data)


@campaigns_router.post("/{row_id}/cancel", response_model=APIResponse[CampaignResponse])
def cancel_campaign(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CampaignService(db).cancel_campaign(ctx, row_id)
    db.commit()
    return APIResponse(message="Campaign cancelled", data=data)


@campaigns_router.get("/{row_id}/audience", response_model=APIResponse[list[CampaignAudienceResponse]])
def list_campaign_audience(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    items = CampaignService(db).list_audience(ctx, row_id)
    return APIResponse(message="OK", data=items)


@campaigns_router.post("/{row_id}/audience", response_model=APIResponse[CampaignAudienceResponse])
def add_campaign_audience(
    row_id: UUID,
    body: CampaignAudienceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.campaign:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CampaignService(db).add_audience(ctx, row_id, **body.model_dump(exclude_none=True))
    db.commit()
    return APIResponse(message="Audience segment added", data=data)


@channels_router.get("", response_model=APIResponse[list[ChannelResponse]])
def list_channels(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.channel:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    platform: str | None = None,
):
    items = ChannelService(db).list_channels(ctx, company_id=company_id, platform=platform)
    return APIResponse(message="OK", data=paginate(items, pagination))


@channels_router.post("", response_model=APIResponse[ChannelResponse])
def create_channel(
    body: ChannelCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.channel:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude_none=True)
    company_id = payload.pop("company_id", None)
    data = ChannelService(db).create_channel(ctx, company_id=company_id, **payload)
    db.commit()
    return APIResponse(message="Channel created", data=data)


@channels_router.patch("/{row_id}", response_model=APIResponse[ChannelResponse])
def update_channel(
    row_id: UUID,
    body: ChannelUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.channel:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ChannelService(db).update_channel(ctx, row_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Channel updated", data=data)


@content_router.get("", response_model=APIResponse[list[ContentItemResponse]])
def list_content_items(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    status: str | None = None,
    campaign_id: UUID | None = None,
    channel_id: UUID | None = None,
    q: str | None = None,
    mine: bool = False,
):
    items = ContentItemService(db).list_content(
        ctx,
        company_id=company_id,
        status=status,
        campaign_id=campaign_id,
        channel_id=channel_id,
        q=q,
        mine=mine,
    )
    return APIResponse(message="OK", data=paginate(items, pagination))


@content_router.get("/calendar", response_model=APIResponse[list[CalendarItem]])
def list_calendar(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
    start: Annotated[datetime, Query()],
    end: Annotated[datetime, Query()],
    company_id: UUID | None = None,
):
    items = ContentItemService(db).list_calendar(ctx, start, end, company_id=company_id)
    return APIResponse(message="OK", data=items)


@content_router.get("/approvals/pending", response_model=APIResponse[list[ApprovalResponse]])
def list_pending_approvals(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ContentItemService(db).list_pending_approvals(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@content_router.get("/publications", response_model=APIResponse[list[PublicationResponse]])
def list_publications(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.publication:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    channel_id: UUID | None = None,
):
    items = ContentItemService(db).list_publications(ctx, company_id=company_id, channel_id=channel_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@content_router.get("/{row_id}", response_model=APIResponse[ContentItemResponse])
def get_content_item(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ContentItemService(db).get_content(ctx, row_id))


@content_router.get("/{row_id}/timeline", response_model=APIResponse[list[ActivityLogResponse]])
def get_content_timeline(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    items = ContentItemService(db).get_timeline(ctx, row_id)
    return APIResponse(message="OK", data=items)


@content_router.get("/{row_id}/assignments", response_model=APIResponse[list[ContentAssignmentResponse]])
def list_content_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    items = ContentItemService(db).list_assignments(ctx, row_id)
    return APIResponse(message="OK", data=items)


@content_router.post("/{row_id}/assignments", response_model=APIResponse[ContentAssignmentResponse])
def add_content_assignment(
    row_id: UUID,
    body: ContentAssignmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).add_assignment(ctx, row_id, body.user_id, body.role)
    db.commit()
    return APIResponse(message="Assignment added", data=data)


@content_router.post("", response_model=APIResponse[ContentItemResponse])
def create_content_item(
    body: ContentItemCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude_none=True)
    branch_id = payload.pop("branch_id")
    company_id = payload.pop("company_id", None)
    data = ContentItemService(db).create_content(ctx, branch_id=branch_id, company_id=company_id, **payload)
    db.commit()
    return APIResponse(message="Content created", data=data)


@content_router.patch("/{row_id}", response_model=APIResponse[ContentItemResponse])
def update_content_item(
    row_id: UUID,
    body: ContentItemUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).update_content(ctx, row_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Content updated", data=data)


@content_router.post("/{row_id}/submit", response_model=APIResponse[ContentItemResponse])
def submit_content_item(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).submit_content(ctx, row_id)
    db.commit()
    return APIResponse(message="Content submitted for review", data=data)


@content_router.post("/{row_id}/approve-media", response_model=APIResponse[ContentItemResponse])
def approve_media_content_item(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve_media"))],
    db: Annotated[Session, Depends(get_db)],
    body: ContentCommentsPayload | None = None,
):
    comments = body.comments if body else None
    data = ContentItemService(db).approve_media(ctx, row_id, comments=comments)
    db.commit()
    return APIResponse(message="Media approved — ready for marketing head review", data=data)


@content_router.post("/{row_id}/approve", response_model=APIResponse[ContentItemResponse])
def approve_content_item(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
    body: ContentCommentsPayload | None = None,
):
    comments = body.comments if body else None
    data = ContentItemService(db).approve_content(ctx, row_id, comments=comments)
    db.commit()
    return APIResponse(message="Content approved", data=data)


@content_router.post("/{row_id}/request-changes", response_model=APIResponse[ContentItemResponse])
def request_content_changes(
    row_id: UUID,
    body: ContentRejectPayload,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).request_changes(ctx, row_id, body.reason)
    db.commit()
    return APIResponse(message="Changes requested — sent back to creator", data=data)


@content_router.post("/{row_id}/report-posting", response_model=APIResponse[ContentItemResponse])
def report_content_posting(
    row_id: UUID,
    body: PostingReportPayload,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).report_posting(
        ctx,
        row_id,
        posted=body.posted,
        notes=body.notes,
        published_url=body.published_url,
    )
    db.commit()
    return APIResponse(message="Posting status reported to marketing head", data=data)


@content_router.post("/{row_id}/reject", response_model=APIResponse[ContentItemResponse])
def reject_content_item(
    row_id: UUID,
    body: ContentRejectPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).reject_content(ctx, row_id, body.reason)
    db.commit()
    return APIResponse(message="Content rejected", data=data)


@content_router.post("/{row_id}/schedule", response_model=APIResponse[ContentItemResponse])
def schedule_content_item(
    row_id: UUID,
    body: ContentSchedulePayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:schedule"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).schedule_content(ctx, row_id, body.scheduled_at)
    db.commit()
    return APIResponse(message="Content scheduled", data=data)


@content_router.post("/{row_id}/publish", response_model=APIResponse[ContentItemResponse])
def publish_content_item(
    row_id: UUID,
    body: PublicationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).publish_content(
        ctx,
        row_id,
        channel_id=body.channel_id,
        published_url=body.published_url,
        external_post_id=body.external_post_id,
        published_at=body.published_at,
        notes=body.notes,
        metrics_json=body.metrics_json,
    )
    db.commit()
    return APIResponse(message="Content published", data=data)


@content_router.post("/{row_id}/archive", response_model=APIResponse[ContentItemResponse])
def archive_content_item(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:archive"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).archive_content(ctx, row_id)
    db.commit()
    return APIResponse(message="Content archived", data=data)


@content_router.get("/{row_id}/verifications", response_model=APIResponse[list[dict]])
def list_content_verifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = VerificationService(db).list_verifications(ctx, row_id)
    return APIResponse(message="OK", data=data)


@content_router.get("/{row_id}/workflow", response_model=APIResponse[dict])
def get_content_workflow(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = VerificationService(db).get_workflow_dashboard(ctx, row_id)
    return APIResponse(message="OK", data=data)


@content_router.patch("/{row_id}/verifications/items", response_model=APIResponse[dict])
def update_verification_item(
    row_id: UUID,
    body: VerificationItemUpdatePayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = VerificationService(db).head_review_item(
        ctx,
        row_id,
        verifier_role=body.verifier_role or "",
        item_key=body.item_key,
        status=body.status,
        comments=body.comments,
    )
    db.commit()
    return APIResponse(message="Head review saved", data=data)


@content_router.post("/{row_id}/verifications/submit-item", response_model=APIResponse[dict])
def submit_verification_item(
    row_id: UUID,
    body: VerificationSubmitItemPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = VerificationService(db).submit_item_to_head(
        ctx, row_id, item_key=body.item_key, verifier_role=body.verifier_role
    )
    db.commit()
    return APIResponse(message="Submitted to marketing head", data=data)


@content_router.post("/{row_id}/verifications/head-review", response_model=APIResponse[dict])
def head_review_verification_item(
    row_id: UUID,
    body: HeadReviewItemPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = VerificationService(db).head_review_item(
        ctx,
        row_id,
        verifier_role=body.verifier_role,
        item_key=body.item_key,
        status=body.status,
        comments=body.comments,
    )
    db.commit()
    return APIResponse(message="Head review saved", data=data)


@content_router.post("/{row_id}/linkedin/head-review-section", response_model=APIResponse[ContentItemResponse])
def linkedin_head_review_section(
    row_id: UUID,
    body: LinkedInHeadSectionReviewPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = LinkedInSectionService(db).head_review_section(
        ctx,
        row_id,
        section_id=body.section,
        status=body.status,
        comments=body.comments,
    )
    db.commit()
    return APIResponse(message="Section review saved", data=ContentItemResponse.model_validate(row))


@content_router.post("/{row_id}/linkedin/submit-final-draft-to-head", response_model=APIResponse[ContentItemResponse])
def linkedin_submit_final_draft_to_head(
    row_id: UUID,
    body: LinkedInSubmitFinalDraftPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = LinkedInSectionService(db).submit_final_draft_to_head(
        ctx,
        row_id,
        content_text=body.content_text,
        poster_media_asset_id=body.poster_media_asset_id,
    )
    db.commit()
    return APIResponse(message="Final draft sent to marketing head", data=ContentItemResponse.model_validate(row))


@content_router.post("/{row_id}/linkedin/head-review-final-draft", response_model=APIResponse[ContentItemResponse])
def linkedin_head_review_final_draft(
    row_id: UUID,
    body: LinkedInHeadFinalDraftReviewPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = LinkedInSectionService(db).head_review_final_draft(
        ctx,
        row_id,
        status=body.status,
        comments=body.comments,
    )
    db.commit()
    return APIResponse(message="Final draft review saved", data=ContentItemResponse.model_validate(row))


@content_router.post("/{row_id}/linkedin/send-to-publisher", response_model=APIResponse[ContentItemResponse])
def linkedin_send_to_publisher(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = LinkedInSectionService(db).send_final_draft_to_publisher(ctx, row_id)
    db.commit()
    return APIResponse(message="Final draft sent to publisher", data=ContentItemResponse.model_validate(row))


@content_router.post("/{row_id}/verifications/posting-timeline", response_model=APIResponse[dict])
def set_posting_timeline(
    row_id: UUID,
    body: PostingTimelinePayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = VerificationService(db).set_posting_timeline(
        ctx,
        row_id,
        verifier_role=body.verifier_role,
        planned_at=body.planned_at,
        notes=body.notes,
        posted=body.posted,
    )
    db.commit()
    return APIResponse(message="Posting timeline saved", data=data)


@content_router.post("/{row_id}/verifications/send-to-publisher", response_model=APIResponse[dict])
def send_to_publisher(
    row_id: UUID,
    body: SendToPublisherPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = VerificationService(db).send_to_publisher(ctx, row_id, verifier_role=body.verifier_role)
    db.commit()
    return APIResponse(message="Sent to publisher", data=data)


@content_router.post("/{row_id}/verifications/publisher-report", response_model=APIResponse[dict])
def publisher_upload_report(
    row_id: UUID,
    body: PublisherUploadReportPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = VerificationService(db).publisher_upload_report(
        ctx, row_id, verifier_role=body.verifier_role, uploaded=body.uploaded, notes=body.notes
    )
    db.commit()
    return APIResponse(message="Publisher report saved", data=data)


@content_router.post("/{row_id}/assets", response_model=APIResponse[dict])
def link_content_asset(
    row_id: UUID,
    body: ContentAssetLinkPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).link_asset(
        ctx, row_id, body.media_asset_id, asset_role=body.asset_role, sort_order=body.sort_order
    )
    db.commit()
    return APIResponse(message="Asset linked", data=data)


@content_router.get("/{row_id}/assets", response_model=APIResponse[list[dict]])
def list_content_assets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ContentItemService(db).list_linked_assets(ctx, row_id)
    return APIResponse(message="OK", data=data)


@assets_router.get("", response_model=APIResponse[list[MediaAssetResponse]])
def list_assets(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    q: str | None = None,
):
    items = MediaAssetService(db).list_assets(ctx, company_id=company_id, q=q)
    return APIResponse(message="OK", data=paginate(items, pagination))


@assets_router.post("/upload", response_model=APIResponse[MediaAssetResponse])
def upload_asset(
    body: AssetUploadPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.asset:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = MediaAssetService(db).upload_asset(
        ctx,
        name=body.name,
        content_base64=body.content_base64,
        company_id=body.company_id,
        mime_type=body.mime_type,
        asset_kind=body.asset_kind,
        width_px=body.width_px,
        height_px=body.height_px,
        alt_text=body.alt_text,
        description=body.description,
    )
    db.commit()
    return APIResponse(message="Asset uploaded", data=data)


@assets_router.post("", response_model=APIResponse[MediaAssetResponse])
def create_asset(
    body: MediaAssetCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.asset:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude_none=True)
    company_id = payload.pop("company_id", None)
    data = MediaAssetService(db).create_asset(ctx, company_id=company_id, **payload)
    db.commit()
    return APIResponse(message="Asset created", data=data)


@dashboard_router.get("/stats", response_model=APIResponse[DashboardStats])
def get_dashboard_stats(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=DashboardService(db).get_stats(ctx, company_id=company_id))


@pipeline_router.get("/my-work", response_model=APIResponse[PipelineWorkResponse])
def get_pipeline_my_work(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=PipelineService(db).get_my_work(ctx, company_id=company_id))


@pipeline_router.get("/head-review", response_model=APIResponse[PipelineHeadReviewResponse])
def get_pipeline_head_review(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=PipelineService(db).get_head_review_board(ctx, company_id=company_id))


@pipeline_router.get("/head-verification-dashboard", response_model=APIResponse[dict])
def get_head_verification_dashboard(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:approve"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=VerificationService(db).head_dashboard(ctx, company_id=company_id))


@reports_router.get("/summary", response_model=APIResponse[ReportSummary])
def get_report_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=ReportService(db).get_summary(ctx, company_id=company_id))
