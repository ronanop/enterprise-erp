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
    branch_id: UUID | None
    source_code: str
    source_name: str
    channel: str | None
    status: str
    company_id: UUID
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
    branch_id: UUID | None
    pipeline_code: str
    pipeline_name: str
    is_default: bool
    status: str
    stages_json: dict | list | None
    company_id: UUID
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
    remark: str | None = None


class LeadResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    lead_code: str
    first_name: str
    last_name: str | None
    salutation: str | None = None
    mobile: str
    email: str | None
    status: str
    blueprint_state: str
    locked: bool
    company_account_id: UUID | None
    owner_employee_id: UUID
    assign_to_id: UUID | None
    assigned_date: date | None = None
    expected_amount: Decimal | None
    expected_closure_date: date | None
    project_title: str | None
    product_type: str | None
    sub_product_category: str | None
    sub_product: str | None
    sub_product_other: str | None
    engagement_score: int | None = None
    portal_link: str | None = None
    requirement_type: str | None = None
    purchase_model: str | None = None
    dr_number: str | None = None
    new_dr_number: str | None = None
    deal_type: str | None = None
    industry: str | None = None
    territory: str | None = None
    region: str | None = None
    street: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    country: str | None = None
    entity_name: str | None
    entity_email: str | None
    entity_address: str | None
    entity_gst: str | None
    entity_contact: str | None
    oem_name: str | None = None
    oem_contact_person: str | None = None
    oem_contact_number: str | None = None
    oem_contact_email: str | None = None
    distributor_name: str | None = None
    distributor_contact: str | None = None
    distributor_contact_person: str | None = None
    distributor_contact_email: str | None = None
    distributor_department: str | None = None
    end_customer_name: str | None = None
    end_customer_location: str | None = None
    notes: str | None
    convert_remark: str | None = None
    lost_reason: str | None = None
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
    lead_id: UUID | None
    company_account_id: UUID | None
    opportunity_code: str
    opportunity_name: str
    project_title: str | None
    owner_employee_id: UUID
    status: str
    current_stage: str
    expected_revenue: Decimal
    probability_percent: Decimal
    forecast_amount: Decimal | None
    customer_id: UUID | None
    sales_quotation_id: UUID | None
    sales_order_id: UUID | None
    blueprint_state: str | None = None
    locked: bool = False
    boq_attached: bool = False
    sow_attached: bool = False
    oem_quote_attached: bool = False
    customer_po_attached: bool = False
    customer_po_approved: bool = False
    version: int
    created_at: datetime | None = None


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
    branch_id: UUID | None
    campaign_code: str
    campaign_name: str
    campaign_type: str
    start_date: date | None
    end_date: date | None
    budget_amount: Decimal | None
    currency_code: str | None
    owner_employee_id: UUID | None
    status: str
    company_id: UUID
    version: int


class TaskCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    title: str
    description: str | None = None
    owner_employee_id: UUID
    assigned_to_employee_id: UUID | None = None
    due_at: datetime | None = None
    priority: str = Field(default="medium", pattern="^(highest|high|medium|low)$")
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    customer_id: UUID | None = None
    account_name: str | None = None
    opportunity_name: str | None = None
    reminder_date: date | None = None
    reminder_time: time | None = None
    email: str | None = None
    repeat_rule: str | None = None


class TaskResponse(OrmModel):
    id: UUID
    task_code: str
    title: str
    description: str | None
    lead_id: UUID | None
    opportunity_id: UUID | None
    customer_id: UUID | None
    owner_employee_id: UUID
    assigned_to_employee_id: UUID | None = None
    account_name: str | None = None
    opportunity_name: str | None = None
    due_at: datetime | None
    reminder_date: date | None = None
    reminder_time: time | None = None
    email: str | None = None
    repeat_rule: str | None = None
    priority: str
    status: str
    completed_at: datetime | None
    company_id: UUID
    branch_id: UUID
    version: int


class MeetingCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    title: str
    meeting_date: date
    organizer_employee_id: UUID
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    all_day: bool = False
    location: str | None = None
    meeting_mode: str | None = None
    related_to: str | None = None
    repeat_rule: str | None = None
    participants_reminder: str | None = None
    reminder_primary: str | None = None
    reminder_secondary: str | None = None
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    customer_id: UUID | None = None
    company_account_id: UUID | None = None
    participants_text: str | None = None
    notes: str | None = None
    tagged_employee_id: UUID | None = None


class MeetingResponse(OrmModel):
    id: UUID
    meeting_code: str
    title: str
    meeting_date: date
    end_date: date | None = None
    start_time: time | None
    end_time: time | None
    all_day: bool = False
    location: str | None
    meeting_mode: str | None
    related_to: str | None = None
    repeat_rule: str | None = None
    participants_reminder: str | None = None
    reminder_primary: str | None = None
    reminder_secondary: str | None = None
    lead_id: UUID | None
    opportunity_id: UUID | None
    customer_id: UUID | None
    company_account_id: UUID | None = None
    organizer_employee_id: UUID
    tagged_employee_id: UUID | None = None
    participants_text: str | None
    notes: str | None
    outcome: str | None
    status: str
    company_id: UUID
    branch_id: UUID
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
    interaction_at: datetime
    lead_id: UUID | None
    opportunity_id: UUID | None
    customer_id: UUID | None
    owner_employee_id: UUID
    channel: str | None
    direction: str | None
    subject: str | None
    summary: str | None
    outcome: str | None
    call_log_id: UUID | None
    email_log_id: UUID | None
    meeting_id: UUID | None
    visit_log_id: UUID | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int


class FollowupCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    owner_employee_id: UUID
    followup_at: datetime
    followup_type: str = "call"
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    company_account_id: UUID | None = None
    customer_name: str | None = None
    notes: str | None = None


class FollowupResponse(OrmModel):
    id: UUID
    followup_code: str
    lead_id: UUID | None
    opportunity_id: UUID | None
    company_account_id: UUID | None
    customer_name: str | None
    owner_employee_id: UUID
    followup_at: datetime
    followup_type: str
    notes: str | None
    outcome: str | None
    status: str
    related_task_id: UUID | None
    company_id: UUID
    branch_id: UUID
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
    feedback_date: date
    feedback_type: str
    rating: int | None
    comments: str | None
    source_module: str | None
    source_document_id: UUID | None
    opportunity_id: UUID | None
    lead_id: UUID | None
    owner_employee_id: UUID | None
    status: str
    company_id: UUID
    branch_id: UUID
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
    branch_id: UUID | None
    customer_id: UUID
    score_period_start: date
    score_period_end: date
    csat_score: Decimal
    nps_score: Decimal | None
    survey_count: int
    quality_satisfaction_ref_id: UUID | None
    status: str
    company_id: UUID
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
    """Shared response for call / email / visit activity logs."""

    id: UUID
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    customer_id: UUID | None = None
    employee_id: UUID
    # call
    called_at: datetime | None = None
    duration_seconds: int | None = None
    phone_number: str | None = None
    # email
    sent_at: datetime | None = None
    from_address: str | None = None
    to_address: str | None = None
    subject: str | None = None
    body_preview: str | None = None
    # visit
    visited_at: datetime | None = None
    location_text: str | None = None
    purpose: str | None = None
    # shared
    direction: str | None = None
    outcome: str | None = None
    notes: str | None = None
    status: str
    company_id: UUID
    branch_id: UUID
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
    activity_at: datetime
    owner_employee_id: UUID
    subject: str | None
    notes: str | None
    outcome: str | None
    related_meeting_id: UUID | None
    related_task_id: UUID | None
    status: str
    company_id: UUID
    branch_id: UUID


class LeadAssignmentResponse(OrmModel):
    id: UUID
    lead_id: UUID
    assignment_type: str
    from_employee_id: UUID | None
    to_employee_id: UUID
    assigned_at: datetime
    assignment_reason: str | None
    status: str
    company_id: UUID
    branch_id: UUID


class OpportunityStageResponse(OrmModel):
    id: UUID
    opportunity_id: UUID
    sequence_no: int
    stage_code: str
    stage_name: str
    entered_at: datetime
    exited_at: datetime | None
    probability_percent: Decimal | None
    changed_by_employee_id: UUID | None
    notes: str | None
    company_id: UUID
    branch_id: UUID


class CampaignMemberResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    campaign_id: UUID
    member_type: str
    lead_id: UUID | None
    customer_id: UUID | None
    member_status: str
    added_at: datetime
    company_id: UUID
    version: int


# ---------------------------------------------------------------------------
# Sales CRM (Zoho-replacement) — Company / Contact / Product / Quote / OVF /
# My Jobs / Attachments / Blueprint schemas.
# ---------------------------------------------------------------------------


class CompanyCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    customer_name: str
    account_owner_id: UUID | None = None
    account_type: str
    industry: str
    other_industries: str | None = None
    portal_id: str | None = None
    source: str
    rating: str | None = None
    first_name: str
    last_name: str
    customer_email: str
    phone: str
    website: str | None = None
    account_ownership_id: UUID | None = None
    customer_id_ext: str | None = None
    role: str | None = None
    billing_street: str
    billing_city: str
    billing_state: str
    billing_code: str
    billing_country: str
    shipping_street: str | None = None
    shipping_city: str | None = None
    shipping_state: str | None = None
    shipping_code: str | None = None
    shipping_country: str | None = None
    description: str | None = None
    master_customer_id: UUID | None = None


class CompanyUpdate(BaseModel):
    customer_name: str | None = None
    account_owner_id: UUID | None = None
    account_type: str | None = None
    industry: str | None = None
    other_industries: str | None = None
    portal_id: str | None = None
    source: str | None = None
    rating: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    customer_email: str | None = None
    phone: str | None = None
    website: str | None = None
    account_ownership_id: UUID | None = None
    customer_id_ext: str | None = None
    role: str | None = None
    billing_street: str | None = None
    billing_city: str | None = None
    billing_state: str | None = None
    billing_code: str | None = None
    billing_country: str | None = None
    shipping_street: str | None = None
    shipping_city: str | None = None
    shipping_state: str | None = None
    shipping_code: str | None = None
    shipping_country: str | None = None
    description: str | None = None
    status: str | None = None
    version: int | None = None


class CompanyResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    account_number: str
    customer_name: str
    account_owner_id: UUID | None
    account_type: str | None
    industry: str
    other_industries: str | None
    portal_id: str | None
    source: str
    rating: str | None
    first_name: str | None
    last_name: str | None
    customer_email: str | None
    phone: str | None
    website: str | None
    account_ownership_id: UUID | None
    customer_id_ext: str | None
    role: str | None
    billing_street: str
    billing_city: str
    billing_state: str
    billing_code: str
    billing_country: str
    shipping_street: str | None
    shipping_city: str | None
    shipping_state: str | None
    shipping_code: str | None
    shipping_country: str | None
    description: str | None
    master_customer_id: UUID | None
    status: str
    locked: bool
    version: int
    created_at: datetime | None = None


class ContactCreate(BaseModel):
    company_account_id: UUID
    branch_id: UUID
    first_name: str
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    mobile: str | None = None
    title: str | None = None
    is_primary: bool = False
    owner_id: UUID | None = None


class ContactUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    mobile: str | None = None
    title: str | None = None
    is_primary: bool | None = None
    status: str | None = None
    version: int | None = None


class ContactResponse(OrmModel):
    id: UUID
    company_account_id: UUID
    company_id: UUID
    branch_id: UUID
    first_name: str
    last_name: str | None
    email: str | None
    phone: str | None
    mobile: str | None
    title: str | None
    is_primary: bool
    owner_id: UUID | None
    status: str
    version: int


class LeadCreateFromCompany(BaseModel):
    """Body for POST /crm/companies/{id}/leads — the only sales-lead entry point."""

    branch_id: UUID
    first_name: str | None = None
    last_name: str | None = None
    salutation: str | None = None
    mobile: str | None = None
    email: str | None = None
    lead_source_id: UUID
    owner_employee_id: UUID
    assign_to_id: UUID | None = None
    assigned_date: date | None = None
    expected_amount: Decimal | None = None
    expected_closure_date: date | None = None
    product_type: str | None = None
    sub_product_category: str | None = None
    sub_product: str | None = None
    sub_product_other: str | None = None
    engagement_score: int | None = None
    portal_link: str | None = None
    project_title: str | None = None
    requirement_type: str | None = None
    purchase_model: str | None = None
    dr_number: str | None = None
    new_dr_number: str | None = None
    deal_type: str | None = None
    industry: str | None = None
    territory: str | None = None
    region: str | None = None
    street: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    country: str | None = None
    oem_name: str | None = None
    oem_contact_person: str | None = None
    oem_contact_number: str | None = None
    oem_contact_email: str | None = None
    distributor_name: str | None = None
    distributor_contact: str | None = None
    distributor_contact_person: str | None = None
    distributor_contact_email: str | None = None
    distributor_department: str | None = None
    end_customer_name: str | None = None
    end_customer_location: str | None = None
    entity_name: str | None = None
    entity_email: str | None = None
    entity_address: str | None = None
    entity_gst: str | None = None
    entity_contact: str | None = None
    notes: str | None = None


class LeadLostRequest(BaseModel):
    reason: str | None = None


class SalesLeadResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    lead_code: str
    first_name: str
    last_name: str | None
    mobile: str
    email: str | None
    status: str
    blueprint_state: str
    locked: bool
    company_account_id: UUID | None
    owner_employee_id: UUID
    assign_to_id: UUID | None
    expected_amount: Decimal | None
    expected_closure_date: date | None
    project_title: str | None = None
    product_type: str | None = None
    sub_product_category: str | None = None
    sub_product: str | None = None
    sub_product_other: str | None = None
    entity_name: str | None = None
    entity_email: str | None = None
    entity_address: str | None = None
    entity_gst: str | None = None
    entity_contact: str | None = None
    oem_name: str | None = None
    oem_contact_person: str | None = None
    oem_contact_number: str | None = None
    oem_contact_email: str | None = None
    distributor_name: str | None = None
    distributor_contact: str | None = None
    distributor_contact_person: str | None = None
    distributor_contact_email: str | None = None
    distributor_department: str | None = None
    end_customer_name: str | None = None
    end_customer_location: str | None = None
    notes: str | None = None
    converted_opportunity_id: UUID | None
    version: int


class ProductCreate(BaseModel):
    company_id: UUID | None = None
    product_code: str | None = None
    product_name: str
    product_type: str
    hsn_sac: str | None = None
    unit_price: Decimal = Decimal("0")
    status: str = "active"


class ProductUpdate(BaseModel):
    product_name: str | None = None
    hsn_sac: str | None = None
    unit_price: Decimal | None = None
    status: str | None = None
    version: int | None = None


class ProductResponse(OrmModel):
    id: UUID
    company_id: UUID
    product_code: str
    product_name: str
    product_type: str
    hsn_sac: str | None
    unit_price: Decimal
    status: str
    version: int


class OemCreate(BaseModel):
    company_id: UUID | None = None
    oem_code: str | None = None
    oem_name: str
    contact_person: str | None = None
    contact_number: str | None = None
    contact_email: str | None = None
    status: str = "active"


class OemUpdate(BaseModel):
    oem_name: str | None = None
    contact_person: str | None = None
    contact_number: str | None = None
    contact_email: str | None = None
    status: str | None = None
    version: int | None = None


class OemResponse(OrmModel):
    id: UUID
    company_id: UUID
    oem_code: str
    oem_name: str
    contact_person: str | None
    contact_number: str | None
    contact_email: str | None
    status: str
    version: int


class QuoteCreate(BaseModel):
    opportunity_id: UUID
    branch_id: UUID
    contact_id: UUID | None = None
    subject: str | None = None
    project_title: str | None = None
    account_name: str | None = None
    service_type: str | None = None
    owner_name: str | None = None
    valid_until: date | None = None
    entity_name: str | None = None
    entity_email: str | None = None
    entity_address: str | None = None
    entity_gst: str | None = None
    entity_contact: str | None = None
    billing_country: str | None = None
    shipping_country: str | None = None
    freight: Decimal = Decimal("0")
    terms: str | None = None
    description: str | None = None
    reason_for_discount: str | None = None


class QuoteUpdate(BaseModel):
    contact_id: UUID | None = None
    subject: str | None = None
    project_title: str | None = None
    account_name: str | None = None
    service_type: str | None = None
    owner_name: str | None = None
    valid_until: date | None = None
    entity_name: str | None = None
    entity_email: str | None = None
    entity_address: str | None = None
    entity_gst: str | None = None
    entity_contact: str | None = None
    billing_country: str | None = None
    shipping_country: str | None = None
    freight: Decimal | None = None
    terms: str | None = None
    description: str | None = None
    reason_for_discount: str | None = None
    version: int | None = None


class QuoteResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    opportunity_id: UUID
    company_account_id: UUID | None
    contact_id: UUID | None
    subject: str | None
    project_title: str | None = None
    account_name: str | None = None
    service_type: str | None = None
    owner_name: str | None = None
    entity_name: str | None
    entity_email: str | None
    entity_address: str | None
    entity_gst: str | None
    entity_contact: str | None
    billing_country: str | None
    shipping_country: str | None
    quote_no: str
    quote_revision: int
    quote_stage: str
    approval_status: str
    locked: bool
    valid_until: date | None
    freight: Decimal
    grand_total: Decimal
    avg_margin_pct: Decimal
    total_margin_amount: Decimal
    reason_for_discount: str | None
    terms: str | None = None
    description: str | None = None
    sales_order_id: UUID | None
    version: int
    created_at: datetime | None = None


class QuoteLineCreate(BaseModel):
    product_id: UUID | None = None
    product_name: str
    hsn_sac: str | None = None
    description: str | None = None
    line_type: str = "hardware"
    qty: Decimal = Decimal("1")
    unit_cost: Decimal = Decimal("0")
    unit_sell: Decimal = Decimal("0")
    gst_pct: Decimal = Decimal("0")


class QuoteLineUpdate(BaseModel):
    product_name: str | None = None
    hsn_sac: str | None = None
    description: str | None = None
    line_type: str | None = None
    qty: Decimal | None = None
    unit_cost: Decimal | None = None
    unit_sell: Decimal | None = None
    gst_pct: Decimal | None = None
    version: int | None = None


class QuoteLineResponse(OrmModel):
    id: UUID
    quote_id: UUID
    line_no: int
    product_id: UUID | None
    product_name: str
    hsn_sac: str | None
    description: str | None = None
    line_type: str
    qty: Decimal
    unit_cost: Decimal
    unit_sell: Decimal
    margin_pct: Decimal
    margin_amount: Decimal
    gst_pct: Decimal
    gst_amount: Decimal
    line_total: Decimal
    version: int


class QuoteMarginSummaryResponse(BaseModel):
    quote_id: UUID
    avg_margin_pct: Decimal
    total_margin_amount: Decimal
    total_sell_amount: Decimal
    required_threshold_pct: Decimal
    requires_management_approval: bool
    line_types_present: list[str]


class QuoteSendForApprovalRequest(BaseModel):
    team_role: str = "management"
    remarks: str | None = None


class QuoteActionRequest(BaseModel):
    remark: str | None = None
    valid_until: date | None = None


class OvfCreate(BaseModel):
    quote_id: UUID
    branch_id: UUID
    po_number: str | None = None
    delivery_period: str | None = None
    customer_name: str | None = None
    quote_name: str | None = None
    billing_address: str | None = None
    billing_state: str | None = None
    billing_country: str | None = None
    owner_name: str | None = None
    billing_contact_person: str | None = None
    shipping_address: str | None = None
    shipping_state: str | None = None
    shipping_country: str | None = None
    shipping_contact_person: str | None = None
    account_name: str | None = None
    technology_segment: str | None = None
    sub_technology_segment: str | None = None
    installation_details: str | None = None
    vendor_payment_days: int = 0
    customer_payment_days: int = 0
    additional_charges: Decimal = Decimal("0")
    freight: Decimal = Decimal("0")
    total_margin_amount: Decimal | None = None
    total_margin_pct: Decimal | None = None
    finance_cost_pct: Decimal | None = None
    approval_status: str | None = None


class OvfUpdate(BaseModel):
    po_number: str | None = None
    delivery_period: str | None = None
    customer_name: str | None = None
    quote_name: str | None = None
    billing_address: str | None = None
    billing_state: str | None = None
    billing_country: str | None = None
    owner_name: str | None = None
    billing_contact_person: str | None = None
    shipping_address: str | None = None
    shipping_state: str | None = None
    shipping_country: str | None = None
    shipping_contact_person: str | None = None
    account_name: str | None = None
    technology_segment: str | None = None
    sub_technology_segment: str | None = None
    installation_details: str | None = None
    vendor_payment_days: int | None = None
    customer_payment_days: int | None = None
    additional_charges: Decimal | None = None
    freight: Decimal | None = None
    total_margin_amount: Decimal | None = None
    total_margin_pct: Decimal | None = None
    finance_cost_pct: Decimal | None = None
    approval_status: str | None = None
    version: int | None = None


class OvfResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    ovf_no: str
    quote_id: UUID
    opportunity_id: UUID
    company_account_id: UUID | None
    po_number: str | None
    delivery_period: str | None
    customer_name: str | None
    quote_name: str | None
    billing_address: str | None
    billing_state: str | None
    billing_country: str | None
    owner_name: str | None
    billing_contact_person: str | None
    shipping_address: str | None
    shipping_state: str | None
    shipping_country: str | None
    shipping_contact_person: str | None
    account_name: str | None
    technology_segment: str | None
    sub_technology_segment: str | None
    installation_details: str | None
    approval_status: str
    blueprint_state: str
    locked: bool
    shared_to_scm: bool
    deal_won: bool
    deal_won_amount: Decimal | None
    vendor_payment_days: int
    customer_payment_days: int
    finance_cost_pct: Decimal
    additional_charges: Decimal
    freight: Decimal
    total_margin_pct: Decimal
    total_margin_amount: Decimal
    version: int
    created_at: datetime | None = None


class OvfLineCreate(BaseModel):
    side: str = "customer_po"
    product_name: str
    qty: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")


class OvfLineUpdate(BaseModel):
    product_name: str | None = None
    qty: Decimal | None = None
    unit_price: Decimal | None = None
    version: int | None = None


class OvfLineResponse(OrmModel):
    id: UUID
    ovf_id: UUID
    side: str
    line_no: int
    product_name: str
    qty: Decimal
    unit_price: Decimal
    line_total: Decimal
    version: int


class OvfSendForApprovalRequest(BaseModel):
    team_role: str = "management"
    remarks: str | None = None


class OvfDealWonRequest(BaseModel):
    deal_won_amount: Decimal


class AttachmentCreate(BaseModel):
    entity_type: str
    entity_id: UUID
    branch_id: UUID
    company_id: UUID | None = None
    file_name: str
    category: str = "other"
    source: str = Field(default="upload", pattern="^(upload|link|google_drive|onedrive|dropbox|box)$")
    file_path: str | None = None
    content_base64: str | None = None
    content_type: str | None = None


class AttachmentResponse(OrmModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    file_name: str
    file_path: str
    content_type: str | None
    size: int | None
    category: str
    source: str = "upload"
    uploaded_by: UUID | None
    company_id: UUID
    branch_id: UUID


class ApprovalTaskResponse(OrmModel):
    id: UUID
    task_code: str
    title: str
    entity_type: str
    entity_id: UUID
    team_role: str
    assigned_role: str | None
    assigned_user_id: UUID | None
    status: str
    requested_by: UUID | None
    remarks: str | None
    decision_remark: str | None
    decided_at: datetime | None
    decided_by: UUID | None
    priority: str
    due_at: datetime | None
    notification_sent: bool
    action: str | None
    company_id: UUID
    branch_id: UUID


class ApprovalTaskDecisionRequest(BaseModel):
    decision: str = Field(pattern="^(approved|rejected)$")
    remark: str | None = None


class BlueprintStateResponse(BaseModel):
    entity_type: str
    entity_id: UUID
    state: str
    locked: bool
    allowed_actions: list[str]
    is_sales_blueprint: bool | None = None


class OpportunityTimelineEventResponse(BaseModel):
    id: str
    occurred_at: datetime
    event_type: str
    entity_type: str
    entity_id: UUID
    entity_label: str | None = None
    title: str
    summary: str | None = None
    action: str | None = None
    from_state: str | None = None
    to_state: str | None = None
    actor_id: UUID | None = None
    actor_name: str | None = None
    requested_by_id: UUID | None = None
    requested_by_name: str | None = None
    decided_by_id: UUID | None = None
    decided_by_name: str | None = None
    decision: str | None = None
    team_role: str | None = None
    remark: str | None = None
    version: int | None = None


class OpportunityTimelineResponse(BaseModel):
    opportunity_id: UUID
    opportunity_code: str | None = None
    opportunity_name: str | None = None
    events: list[OpportunityTimelineEventResponse]


class BlueprintActionRequest(BaseModel):
    """Generic action payload — fields are action-specific and all optional.

    e.g. ``file_name``/``file_path``/``content_base64`` for attach_* actions,
    ``team_role``/``remarks`` for send_*_approval, ``deal_reg_number`` for
    deal_reg, ``reason``/``remark`` for lost, ``valid_until`` for
    send_to_customer, ``deal_won_amount`` for deal_won.
    """

    file_name: str | None = None
    file_path: str | None = None
    content_base64: str | None = None
    content_type: str | None = None
    team_role: str | None = None
    remarks: str | None = None
    remark: str | None = None
    reason: str | None = None
    deal_reg_number: str | None = None
    valid_until: date | None = None
    deal_won_amount: Decimal | None = None

    def to_payload(self) -> dict:
        return self.model_dump(exclude_none=True)
