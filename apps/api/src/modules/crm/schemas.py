"""CRM Pydantic schemas."""

from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LeadSourceCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    source_code: str
    source_name: str
    channel: str | None = None
    status: str = "active"


class LeadSourceUpdate(BaseModel):
    source_name: str | None = None
    channel: str | None = None
    status: str | None = None
    version: int | None = None


class LeadSourceResponse(OrmModel):
    id: UUID
    company_id: UUID
    source_code: str
    source_name: str
    channel: str | None
    status: str
    version: int


class PipelineCreate(BaseModel):
    company_id: UUID | None = None
    pipeline_code: str | None = None
    pipeline_name: str
    is_default: bool = False
    stages_json: dict | None = None
    status: str = "active"


class PipelineUpdate(BaseModel):
    pipeline_name: str | None = None
    is_default: bool | None = None
    stages_json: dict | None = None
    status: str | None = None
    version: int | None = None


class PipelineResponse(OrmModel):
    id: UUID
    company_id: UUID
    pipeline_code: str
    pipeline_name: str
    is_default: bool
    status: str
    version: int


class LeadCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    first_name: str
    last_name: str | None = None
    company_name: str | None = None
    email: str | None = None
    mobile: str
    lead_source_id: UUID
    owner_employee_id: UUID
    document_date: date | None = None
    territory: str | None = None
    industry: str | None = None
    region: str | None = None
    campaign_id: UUID | None = None
    notes: str | None = None


class LeadUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    mobile: str | None = None
    status: str | None = None
    notes: str | None = None
    version: int | None = None


class LeadAssignRequest(BaseModel):
    to_employee_id: UUID
    assignment_type: str = "manual"
    assignment_reason: str | None = None


class LeadConvertRequest(BaseModel):
    pipeline_id: UUID
    opportunity_name: str
    expected_revenue: Decimal = Decimal("0")
    existing_customer_id: UUID | None = None
    create_customer: bool = True


class LeadResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    lead_code: str
    first_name: str
    last_name: str | None
    mobile: str
    email: str | None
    status: str
    owner_employee_id: UUID
    customer_id: UUID | None
    converted_opportunity_id: UUID | None
    version: int


class OpportunityCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    opportunity_name: str
    pipeline_id: UUID
    owner_employee_id: UUID
    lead_id: UUID | None = None
    customer_id: UUID | None = None
    expected_revenue: Decimal = Decimal("0")
    probability_percent: Decimal = Decimal("0")
    expected_close_date: date | None = None
    current_stage: str = "qualification"


class OpportunityUpdate(BaseModel):
    opportunity_name: str | None = None
    current_stage: str | None = None
    expected_revenue: Decimal | None = None
    probability_percent: Decimal | None = None
    expected_close_date: date | None = None
    customer_id: UUID | None = None
    version: int | None = None


class OpportunityCloseWonRequest(BaseModel):
    create_quotation: bool = True
    currency_code: str = "USD"


class OpportunityCloseLostRequest(BaseModel):
    lost_reason: str | None = None


class OpportunityResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    opportunity_code: str
    opportunity_name: str
    status: str
    current_stage: str
    expected_revenue: Decimal
    probability_percent: Decimal
    forecast_amount: Decimal | None
    customer_id: UUID | None
    sales_quotation_id: UUID | None
    sales_order_id: UUID | None
    version: int


class CampaignCreate(BaseModel):
    company_id: UUID | None = None
    campaign_name: str
    campaign_type: str
    start_date: date | None = None
    end_date: date | None = None
    budget_amount: Decimal | None = None
    owner_employee_id: UUID | None = None


class CampaignUpdate(BaseModel):
    campaign_name: str | None = None
    status: str | None = None
    version: int | None = None


class CampaignMemberCreate(BaseModel):
    member_type: str
    lead_id: UUID | None = None
    customer_id: UUID | None = None
    member_status: str = "invited"


class CampaignResponse(OrmModel):
    id: UUID
    company_id: UUID
    campaign_code: str
    campaign_name: str
    campaign_type: str
    status: str
    version: int


class TaskCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    title: str
    description: str | None = None
    owner_employee_id: UUID
    due_at: datetime | None = None
    priority: str = "medium"
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    customer_id: UUID | None = None


class TaskResponse(OrmModel):
    id: UUID
    task_code: str
    title: str
    status: str
    priority: str
    owner_employee_id: UUID
    version: int


class MeetingCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    title: str
    meeting_date: date
    organizer_employee_id: UUID
    start_time: time | None = None
    end_time: time | None = None
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    customer_id: UUID | None = None


class MeetingResponse(OrmModel):
    id: UUID
    meeting_code: str
    title: str
    meeting_date: date
    status: str
    outcome: str | None
    version: int


class InteractionCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    interaction_type: str
    interaction_at: datetime
    owner_employee_id: UUID
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    customer_id: UUID | None = None
    channel: str | None = None
    subject: str | None = None
    summary: str | None = None


class InteractionResponse(OrmModel):
    id: UUID
    interaction_code: str | None
    interaction_type: str
    status: str
    version: int


class FollowupCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    owner_employee_id: UUID
    followup_at: datetime
    followup_type: str
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    notes: str | None = None


class FollowupResponse(OrmModel):
    id: UUID
    followup_code: str
    status: str
    followup_at: datetime
    version: int


class FeedbackCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    customer_id: UUID
    feedback_date: date
    feedback_type: str
    rating: int | None = Field(default=None, ge=1, le=5)
    comments: str | None = None
    source_module: str | None = None
    source_document_id: UUID | None = None


class FeedbackResponse(OrmModel):
    id: UUID
    feedback_code: str
    customer_id: UUID
    status: str
    rating: int | None
    version: int


class SatisfactionCreate(BaseModel):
    company_id: UUID | None = None
    customer_id: UUID
    score_period_start: date
    score_period_end: date
    csat_score: Decimal = Decimal("0")
    nps_score: Decimal | None = None
    survey_count: int = 0
    quality_satisfaction_ref_id: UUID | None = None


class SatisfactionResponse(OrmModel):
    id: UUID
    customer_id: UUID
    csat_score: Decimal
    nps_score: Decimal | None
    status: str
    version: int


class CallLogCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    called_at: datetime
    direction: str
    status: str = "completed"
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    customer_id: UUID | None = None
    duration_seconds: int | None = None
    phone_number: str | None = None
    outcome: str | None = None
    notes: str | None = None


class EmailLogCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    sent_at: datetime
    direction: str
    status: str = "sent"
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    customer_id: UUID | None = None
    from_address: str | None = None
    to_address: str | None = None
    subject: str | None = None
    body_preview: str | None = None
    notes: str | None = None


class VisitLogCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    visited_at: datetime
    status: str = "planned"
    customer_id: UUID | None = None
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    location_text: str | None = None
    purpose: str | None = None
    notes: str | None = None
    outcome: str | None = None


class LogResponse(OrmModel):
    id: UUID
    status: str
    version: int


class ReportSummaryResponse(BaseModel):
    lead_count: int
    converted_leads: int
    open_opportunities: int
    won_opportunities: int
    pipeline_value: float


class LeadActivityCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    lead_id: UUID
    activity_type: str
    activity_at: datetime
    owner_employee_id: UUID
    subject: str | None = None
    notes: str | None = None
    outcome: str | None = None
    status: str = "planned"


class LeadActivityResponse(OrmModel):
    id: UUID
    lead_id: UUID
    activity_type: str
    status: str


class LeadAssignmentResponse(OrmModel):
    id: UUID
    lead_id: UUID
    to_employee_id: UUID
    assignment_type: str
    status: str


class OpportunityStageResponse(OrmModel):
    id: UUID
    opportunity_id: UUID
    sequence_no: int
    stage_code: str
    stage_name: str


class CampaignMemberResponse(OrmModel):
    id: UUID
    campaign_id: UUID
    member_type: str
    member_status: str
