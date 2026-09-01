"""Marketing API schemas."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class CampaignCreate(BaseModel):
    company_id: UUID | None = None
    name: str
    description: str | None = None
    campaign_type: str = "mixed"
    start_date: date | None = None
    end_date: date | None = None
    budget_amount: Decimal | None = None
    currency_code: str | None = None
    owner_id: UUID | None = None
    goals: str | None = None
    target_audience_summary: str | None = None


class CampaignUpdate(BaseModel):
    version: int | None = None
    name: str | None = None
    description: str | None = None
    campaign_type: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget_amount: Decimal | None = None
    currency_code: str | None = None
    owner_id: UUID | None = None
    goals: str | None = None
    target_audience_summary: str | None = None


class CampaignResponse(BaseModel):
    id: UUID
    campaign_number: str
    name: str
    description: str | None = None
    campaign_type: str
    status: str
    start_date: date | None = None
    end_date: date | None = None
    budget_amount: Decimal | None = None
    currency_code: str | None = None
    owner_id: UUID | None = None
    goals: str | None = None
    target_audience_summary: str | None = None
    company_id: UUID
    version: int
    created_at: datetime
    activated_at: datetime | None = None
    completed_at: datetime | None = None
    submitted_at: datetime | None = None
    approved_at: datetime | None = None
    approved_by_id: UUID | None = None
    rejection_reason: str | None = None

    model_config = {"from_attributes": True}


class ChannelCreate(BaseModel):
    company_id: UUID | None = None
    name: str
    platform: str = "other"
    handle: str | None = None
    profile_url: str | None = None
    description: str | None = None
    is_active: bool = True
    default_handler_id: UUID | None = None


class ChannelUpdate(BaseModel):
    version: int | None = None
    name: str | None = None
    platform: str | None = None
    handle: str | None = None
    profile_url: str | None = None
    description: str | None = None
    is_active: bool | None = None
    default_handler_id: UUID | None = None


class ChannelResponse(BaseModel):
    id: UUID
    name: str
    platform: str
    handle: str | None = None
    profile_url: str | None = None
    description: str | None = None
    is_active: bool
    default_handler_id: UUID | None = None
    company_id: UUID
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentItemCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    title: str
    content_type: str = "social_post"
    campaign_id: UUID | None = None
    channel_id: UUID | None = None
    body: str | None = None
    summary: str | None = None
    call_to_action: str | None = None
    target_url: str | None = None
    hashtags: str | None = None
    theme: str | None = None
    font_name: str | None = None
    font_size: str | None = None
    color_codes: str | None = None
    assigned_to_id: UUID | None = None


class ContentItemUpdate(BaseModel):
    version: int | None = None
    title: str | None = None
    content_type: str | None = None
    campaign_id: UUID | None = None
    channel_id: UUID | None = None
    body: str | None = None
    summary: str | None = None
    call_to_action: str | None = None
    target_url: str | None = None
    hashtags: str | None = None
    theme: str | None = None
    font_name: str | None = None
    font_size: str | None = None
    color_codes: str | None = None
    assigned_to_id: UUID | None = None


class ContentItemResponse(BaseModel):
    id: UUID
    content_number: str
    title: str
    content_type: str
    status: str
    campaign_id: UUID | None = None
    channel_id: UUID | None = None
    body: str | None = None
    summary: str | None = None
    call_to_action: str | None = None
    target_url: str | None = None
    hashtags: str | None = None
    created_by_id: UUID | None = None
    assigned_to_id: UUID | None = None
    approved_by_id: UUID | None = None
    published_by_id: UUID | None = None
    scheduled_at: datetime | None = None
    submitted_at: datetime | None = None
    approved_at: datetime | None = None
    published_at: datetime | None = None
    archived_at: datetime | None = None
    rejection_reason: str | None = None
    posting_report_status: str | None = None
    posting_report_notes: str | None = None
    posting_reported_at: datetime | None = None
    posting_reported_by_id: UUID | None = None
    theme: str | None = None
    font_name: str | None = None
    font_size: str | None = None
    color_codes: str | None = None
    workflow_stage: str | None = None
    final_head_approved_at: datetime | None = None
    linkedin_head_sections: dict | None = None
    linkedin_final_draft: dict | None = None
    business_owner_review: dict | None = None
    video_head_sections: dict | None = None
    video_final_draft: dict | None = None
    company_id: UUID
    branch_id: UUID
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentRejectPayload(BaseModel):
    reason: str | None = None


class PostingReportPayload(BaseModel):
    posted: bool
    notes: str | None = None
    published_url: str | None = None


class ContentSchedulePayload(BaseModel):
    scheduled_at: datetime


class PublicationCreate(BaseModel):
    company_id: UUID | None = None
    content_item_id: UUID
    channel_id: UUID | None = None
    published_url: str | None = None
    external_post_id: str | None = None
    published_at: datetime | None = None
    notes: str | None = None
    metrics_json: dict | None = None


class PublicationResponse(BaseModel):
    id: UUID
    content_item_id: UUID
    channel_id: UUID | None = None
    published_url: str | None = None
    external_post_id: str | None = None
    posted_by_id: UUID | None = None
    published_at: datetime
    notes: str | None = None
    metrics_json: dict | None = None
    company_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ApprovalResponse(BaseModel):
    id: UUID
    content_item_id: UUID
    approver_id: UUID
    status: str
    decision_at: datetime | None = None
    comments: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MediaAssetCreate(BaseModel):
    company_id: UUID | None = None
    name: str
    file_url: str
    mime_type: str | None = None
    file_size_bytes: int | None = None
    alt_text: str | None = None
    description: str | None = None


class MediaAssetResponse(BaseModel):
    id: UUID
    asset_number: str
    name: str
    file_url: str
    mime_type: str | None = None
    file_size_bytes: int | None = None
    alt_text: str | None = None
    description: str | None = None
    uploaded_by_id: UUID | None = None
    company_id: UUID
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityLogResponse(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    action: str
    actor_id: UUID | None = None
    details: str | None = None
    metadata_json: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CalendarItem(BaseModel):
    id: UUID
    content_number: str
    title: str
    status: str
    scheduled_at: datetime
    channel_id: UUID | None = None
    campaign_id: UUID | None = None


class DashboardStats(BaseModel):
    active_campaigns: int = 0
    draft_content: int = 0
    in_review_content: int = 0
    scheduled_content: int = 0
    published_this_month: int = 0
    pending_approvals: int = 0
    active_channels: int = 0


class PipelineFunnelStage(BaseModel):
    key: str
    label: str
    count: int = 0


class PipelineWorkStage(BaseModel):
    key: str
    label: str
    description: str
    count: int = 0
    items: list["ContentItemResponse"] = Field(default_factory=list)
    campaigns: list[dict] = Field(default_factory=list)


class PipelineWorkResponse(BaseModel):
    role_hints: list[str] = Field(default_factory=list)
    stages: list[PipelineWorkStage] = Field(default_factory=list)
    funnel: list[PipelineFunnelStage] = Field(default_factory=list)
    refreshed_at: datetime


class PipelineHeadReviewGroup(BaseModel):
    user_id: UUID | None = None
    display_name: str
    email: str | None = None
    items: list["ContentItemResponse"] = Field(default_factory=list)


class PipelineHeadReviewResponse(BaseModel):
    groups: list[PipelineHeadReviewGroup] = Field(default_factory=list)
    refreshed_at: datetime


class ContentCommentsPayload(BaseModel):
    comments: str | None = None


class CampaignAudienceCreate(BaseModel):
    segment_name: str
    description: str | None = None
    estimated_size: int | None = None


class CampaignAudienceResponse(BaseModel):
    id: UUID
    campaign_id: UUID
    segment_name: str
    description: str | None = None
    status: str
    estimated_size: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentAssignmentCreate(BaseModel):
    user_id: UUID
    role: str = "creator"


class ContentAssignmentResponse(BaseModel):
    id: UUID
    content_item_id: UUID
    user_id: UUID
    role: str
    assigned_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class ReportSummaryItem(BaseModel):
    key: str
    label: str
    count: int


class ReportSummary(BaseModel):
    by_status: list[ReportSummaryItem] = []
    by_channel: list[ReportSummaryItem] = []
    by_campaign: list[ReportSummaryItem] = []
    by_content_type: list[ReportSummaryItem] = []


class VerificationItemUpdatePayload(BaseModel):
    item_key: str
    status: str
    comments: str | None = None
    verifier_role: str | None = None


class VerificationSubmitItemPayload(BaseModel):
    item_key: str
    verifier_role: str | None = None


class HeadReviewItemPayload(BaseModel):
    verifier_role: str
    item_key: str
    status: str
    comments: str | None = None


class LinkedInHeadSectionReviewPayload(BaseModel):
    section: str
    status: str
    comments: str | None = None


class LinkedInSubmitFinalDraftPayload(BaseModel):
    content_text: str | None = None
    poster_media_asset_id: UUID | None = None


class LinkedInHeadFinalDraftReviewPayload(BaseModel):
    status: str
    comments: str | None = None


class BusinessOwnerReviewPayload(BaseModel):
    """Business owner decision after marketing head approves the source draft."""

    status: str  # approved | changes_requested | rejected
    comments: str | None = None


class VideoHeadSectionReviewPayload(BaseModel):
    section: str
    status: str
    comments: str | None = None


class VideoSubmitFinalDraftPayload(BaseModel):
    content_text: str | None = None
    poster_media_asset_id: UUID | None = None


class VideoHeadFinalDraftReviewPayload(BaseModel):
    status: str
    comments: str | None = None


class PostingTimelinePayload(BaseModel):
    verifier_role: str | None = None
    planned_at: datetime | None = None
    notes: str | None = None
    posted: bool | None = None


class SendToPublisherPayload(BaseModel):
    verifier_role: str | None = None


class PublisherUploadReportPayload(BaseModel):
    verifier_role: str
    uploaded: bool
    notes: str | None = None


class VerificationCompletePayload(BaseModel):
    overall_status: str
    overall_comments: str | None = None
    verifier_role: str | None = None


class ContentAssetLinkPayload(BaseModel):
    media_asset_id: UUID
    asset_role: str = "image"
    sort_order: int = 0


class AssetUploadPayload(BaseModel):
    name: str
    content_base64: str
    mime_type: str | None = None
    asset_kind: str = "image"
    width_px: int | None = None
    height_px: int | None = None
    alt_text: str | None = None
    description: str | None = None
    company_id: UUID | None = None
