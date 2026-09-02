"""Marketing Pydantic schemas."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- Platform ----
class PlatformCreate(BaseModel):
    company_id: UUID | None = None
    platform_code: str
    platform_name: str
    channel_type: str = "social"
    is_active: bool = True
    status: str = "active"


class PlatformUpdate(BaseModel):
    platform_name: str | None = None
    channel_type: str | None = None
    is_active: bool | None = None
    status: str | None = None
    version: int | None = None


class PlatformResponse(OrmModel):
    id: UUID
    company_id: UUID
    platform_code: str
    platform_name: str
    channel_type: str
    is_active: bool
    status: str
    version: int


# ---- Campaign ----
class CampaignCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    campaign_name: str
    campaign_type: str = "social"
    objective: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget_amount: Decimal | None = None
    currency_code: str | None = None
    crm_campaign_id: UUID | None = None
    owner_user_id: UUID | None = None
    priority: str = "medium"
    success_metrics: dict | None = None
    stakeholders: dict | None = None
    departments: dict | None = None
    approvers: dict | None = None


class CampaignUpdate(BaseModel):
    campaign_name: str | None = None
    campaign_type: str | None = None
    objective: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget_amount: Decimal | None = None
    currency_code: str | None = None
    crm_campaign_id: UUID | None = None
    owner_user_id: UUID | None = None
    priority: str | None = None
    success_metrics: dict | None = None
    stakeholders: dict | None = None
    departments: dict | None = None
    approvers: dict | None = None
    status: str | None = None
    version: int | None = None


class CampaignResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID | None
    campaign_code: str
    campaign_name: str
    campaign_type: str
    objective: str | None
    start_date: date | None
    end_date: date | None
    budget_amount: Decimal | None
    currency_code: str | None
    crm_campaign_id: UUID | None
    owner_user_id: UUID | None
    priority: str
    success_metrics: dict | None
    stakeholders: dict | None
    departments: dict | None
    approvers: dict | None
    status: str
    version: int


# ---- Pillar ----
class PillarCreate(BaseModel):
    company_id: UUID | None = None
    pillar_code: str
    pillar_name: str
    description: str | None = None
    target_mix_pct: int | None = Field(default=None, ge=0, le=100)
    status: str = "active"


class PillarUpdate(BaseModel):
    pillar_name: str | None = None
    description: str | None = None
    target_mix_pct: int | None = None
    status: str | None = None
    version: int | None = None


class PillarResponse(OrmModel):
    id: UUID
    company_id: UUID
    pillar_code: str
    pillar_name: str
    description: str | None
    target_mix_pct: int | None
    status: str
    version: int


# ---- Brand voice ----
class BrandVoiceCreate(BaseModel):
    company_id: UUID | None = None
    voice_code: str
    voice_name: str
    description: str | None = None
    tone_keywords: dict | None = None
    guidelines: str | None = None


class BrandVoiceUpdate(BaseModel):
    voice_name: str | None = None
    description: str | None = None
    tone_keywords: dict | None = None
    guidelines: str | None = None
    status: str | None = None
    version: int | None = None


class BrandVoiceResponse(OrmModel):
    id: UUID
    company_id: UUID
    voice_code: str
    voice_name: str
    description: str | None
    tone_keywords: dict | None
    guidelines: str | None
    status: str
    version: int


class BrandVoiceSourceCreate(BaseModel):
    source_type: str
    source_label: str
    source_uri: str | None = None
    source_text: str | None = None


class BrandVoiceSourceResponse(OrmModel):
    id: UUID
    company_id: UUID
    brand_voice_id: UUID
    source_type: str
    source_label: str
    source_uri: str | None
    source_text: str | None
    status: str
    version: int


# ---- Social account ----
class SocialAccountCreate(BaseModel):
    company_id: UUID | None = None
    platform_id: UUID
    account_name: str
    account_handle: str
    external_account_id: str | None = None
    status: str = "draft"


class SocialAccountUpdate(BaseModel):
    account_name: str | None = None
    account_handle: str | None = None
    external_account_id: str | None = None
    status: str | None = None
    version: int | None = None


class SocialAccountResponse(OrmModel):
    id: UUID
    company_id: UUID
    platform_id: UUID
    account_name: str
    account_handle: str
    external_account_id: str | None
    status: str
    version: int


# ---- Content request / generated ----
class ContentRequestCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    campaign_id: UUID | None = None
    platform_id: UUID | None = None
    brand_voice_id: UUID | None = None
    pillar_id: UUID | None = None
    topic: str
    content_type: str = "post"
    audience: str | None = None
    tone: str | None = None
    language_code: str = "en"
    goal: str | None = None
    purpose: str | None = None
    technical_depth: str | None = None
    keywords: str | None = None
    reference_notes: str | None = None
    assigned_to_user_id: UUID | None = None
    due_at: datetime | None = None
    inputs: dict | None = None
    generate_now: bool = True


class ContentRequestResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID | None
    campaign_id: UUID | None
    platform_id: UUID | None
    brand_voice_id: UUID | None
    pillar_id: UUID | None
    request_code: str
    topic: str
    content_type: str
    audience: str | None
    tone: str | None
    language_code: str
    goal: str | None
    purpose: str | None
    technical_depth: str | None
    keywords: str | None
    reference_notes: str | None
    assigned_to_user_id: UUID | None
    due_at: datetime | None
    inputs: dict | None
    celery_task_id: str | None
    error_message: str | None
    status: str
    version: int


class GeneratedContentUpdate(BaseModel):
    headline: str | None = None
    hook: str | None = None
    body: str | None = None
    cta: str | None = None
    hashtags: dict | None = None
    status: str | None = None
    version: int | None = None


class GeneratedContentResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID | None
    content_request_id: UUID
    campaign_id: UUID | None
    platform_id: UUID | None
    headline: str | None
    hook: str | None
    body: str
    cta: str | None
    hashtags: dict | None
    scores: dict | None
    pipeline_result: dict | None
    content_version: int
    ai_model: str | None
    token_count: int | None
    status: str
    version: int


class ContentVersionResponse(OrmModel):
    id: UUID
    content_id: UUID
    version_number: int
    snapshot: dict
    version: int


# ---- Research / trends / competitors ----
class ResearchCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    campaign_id: UUID | None = None
    topic: str


class ResearchResponse(OrmModel):
    id: UUID
    company_id: UUID
    campaign_id: UUID | None
    report_code: str
    topic: str
    summary: str | None
    findings: dict | None
    status: str
    version: int


class TrendCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    campaign_id: UUID | None = None
    topic: str


class TrendResponse(OrmModel):
    id: UUID
    company_id: UUID
    campaign_id: UUID | None
    report_code: str
    topic: str
    virality_score: Decimal | None
    summary: str | None
    opportunities: dict | None
    status: str
    version: int


class CompetitorCreate(BaseModel):
    company_id: UUID | None = None
    competitor_code: str
    competitor_name: str
    website_url: str | None = None
    notes: str | None = None
    social_handles: dict | None = None
    status: str = "active"


class CompetitorUpdate(BaseModel):
    competitor_name: str | None = None
    website_url: str | None = None
    notes: str | None = None
    social_handles: dict | None = None
    status: str | None = None
    version: int | None = None


class CompetitorResponse(OrmModel):
    id: UUID
    company_id: UUID
    competitor_code: str
    competitor_name: str
    website_url: str | None
    notes: str | None
    social_handles: dict | None
    status: str
    version: int


# ---- Calendar / publish ----
class CalendarEntryCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    campaign_id: UUID | None = None
    content_id: UUID | None = None
    platform_id: UUID | None = None
    social_account_id: UUID | None = None
    title: str
    notes: str | None = None
    scheduled_at: datetime
    status: str = "planned"


class CalendarEntryUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None
    scheduled_at: datetime | None = None
    status: str | None = None
    version: int | None = None


class CalendarEntryResponse(OrmModel):
    id: UUID
    company_id: UUID
    campaign_id: UUID | None
    content_id: UUID | None
    platform_id: UUID | None
    social_account_id: UUID | None
    title: str
    notes: str | None
    scheduled_at: datetime
    status: str
    version: int


class PublishJobCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    calendar_entry_id: UUID | None = None
    content_id: UUID
    social_account_id: UUID | None = None
    platform_id: UUID | None = None
    scheduled_at: datetime | None = None


class PublishJobResponse(OrmModel):
    id: UUID
    company_id: UUID
    calendar_entry_id: UUID | None
    content_id: UUID
    social_account_id: UUID | None
    platform_id: UUID | None
    scheduled_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    result_payload: dict | None
    error_message: str | None
    status: str
    version: int


class AnalyticsOverviewResponse(BaseModel):
    campaigns_total: int
    campaigns_active: int
    content_requests_total: int
    content_drafts: int
    content_approved: int
    calendar_upcoming: int
    publish_pending: int
    brand_voices: int
    competitors: int
    research_reports: int


class TaskCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    campaign_id: UUID | None = None
    parent_task_id: UUID | None = None
    content_request_id: UUID | None = None
    title: str
    description: str | None = None
    task_kind: str = "general"
    execution_mode: str = "execute"
    complexity: int = Field(default=3, ge=1, le=5)
    estimated_hours: Decimal | None = None
    due_at: datetime | None = None
    is_urgent: bool = False
    owner_user_id: UUID | None = None
    assignee_user_id: UUID | None = None
    reviewer_user_id: UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    task_kind: str | None = None
    execution_mode: str | None = None
    complexity: int | None = None
    estimated_hours: Decimal | None = None
    actual_hours: Decimal | None = None
    due_at: datetime | None = None
    is_urgent: bool | None = None
    assignee_user_id: UUID | None = None
    reviewer_user_id: UUID | None = None
    status: str | None = None
    version: int | None = None


class TaskResponse(OrmModel):
    id: UUID
    company_id: UUID
    campaign_id: UUID | None
    parent_task_id: UUID | None
    task_code: str
    title: str
    description: str | None
    task_kind: str
    execution_mode: str
    complexity: int
    estimated_hours: Decimal | None
    actual_hours: Decimal | None
    due_at: datetime | None
    is_urgent: bool
    owner_user_id: UUID | None
    assignee_user_id: UUID | None
    delegated_by_user_id: UUID | None
    reviewer_user_id: UUID | None
    status: str
    version: int


class DelegateBody(BaseModel):
    assignee_user_id: UUID


class TimeEntryCreate(BaseModel):
    hours: Decimal
    entry_type: str = "work"
    notes: str | None = None


class TimeEntryResponse(OrmModel):
    id: UUID
    task_id: UUID
    user_id: UUID
    hours: Decimal
    entry_type: str
    notes: str | None
    status: str


class ApprovalActBody(BaseModel):
    entity_type: str
    entity_id: UUID
    approval_level: int = Field(ge=1, le=5)
    action: str
    comment: str | None = None
    campaign_id: UUID | None = None
    company_id: UUID | None = None


class ApprovalResponse(OrmModel):
    id: UUID
    campaign_id: UUID | None
    entity_type: str
    entity_id: UUID
    approval_level: int
    actor_user_id: UUID
    action: str
    comment: str | None
    status: str


class M365WorkspaceResponse(OrmModel):
    id: UUID
    campaign_id: UUID
    display_name: str
    teams_group_id: str | None
    teams_channel_id: str | None
    teams_web_url: str | None
    sharepoint_web_url: str | None
    folder_structure: dict | None
    provision_status: str
    last_error: str | None
    status: str


class M365FileCreate(BaseModel):
    company_id: UUID | None = None
    workspace_id: UUID | None = None
    campaign_id: UUID | None = None
    file_name: str
    folder_path: str = "/Content"
    storage_tier: str = "onedrive"
    department: str | None = None
    extra_metadata: dict | None = None


class M365FileResponse(OrmModel):
    id: UUID
    campaign_id: UUID | None
    file_name: str
    folder_path: str
    storage_tier: str
    version_label: str
    approval_stage: str | None
    status: str


class MeetingCreate(BaseModel):
    company_id: UUID | None = None
    campaign_id: UUID | None = None
    task_id: UUID | None = None
    meeting_type: str = "campaign"
    subject: str
    starts_at: datetime
    ends_at: datetime
    attendee_emails: list[str] | None = None


class MeetingResponse(OrmModel):
    id: UUID
    campaign_id: UUID | None
    meeting_type: str
    subject: str
    starts_at: datetime
    ends_at: datetime
    join_url: str | None
    status: str
    last_error: str | None


class AiImproveBody(BaseModel):
    text: str
    mode: str = "simplify"


class AiTopicBody(BaseModel):
    topic: str


class SearchQuery(BaseModel):
    query: str


class OpsEventResponse(OrmModel):
    id: UUID
    campaign_id: UUID | None
    entity_type: str
    entity_id: UUID | None
    actor_user_id: UUID | None
    action: str
    old_value: dict | None
    new_value: dict | None
    comment: str | None
    created_at: datetime
    status: str
