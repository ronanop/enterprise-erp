"""CRM Pydantic schemas."""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


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


class SalesLeadUpdate(BaseModel):
    """Full sales-process lead update (company-account scoped leads only)."""

    version: int
    salutation: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    designation: str | None = None
    mobile: str | None = None
    email: str | None = None
    lead_source_id: UUID | None = None
    partner_names: str | None = None
    marketing_event_id: UUID | None = None
    expected_amount: Decimal | None = None
    committed_amount: Decimal | None = None
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
    sale_type: str | None = None
    entity_name: str | None = None
    entity_email: str | None = None
    entity_address: str | None = None
    entity_gst: str | None = None
    entity_contact: str | None = None
    requires_boq: bool | None = None
    requires_sow: bool | None = None
    notes: str | None = None
    presales_owner_id: UUID | None = None
    presales_call_aligned: bool | None = None
    presales_call_contact_name: str | None = None
    presales_call_by_product: str | None = None
    custom_fields: dict[str, Any] | None = None


class LeadAssignRequest(BaseModel):
    to_employee_id: UUID
    assignment_type: str = "manual"
    assignment_reason: str | None = None


class LeadConvertRequest(BaseModel):
    """Convert uses lead defaults when pipeline / name / revenue are omitted."""

    pipeline_id: UUID | None = None
    opportunity_name: str | None = None
    expected_revenue: Decimal | None = None
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
    designation: str | None = None
    mobile: str
    email: str | None
    lead_source_id: UUID
    partner_names: str | None = None
    marketing_event_id: UUID | None = None
    status: str
    blueprint_state: str
    locked: bool
    company_account_id: UUID | None
    owner_employee_id: UUID
    assign_to_id: UUID | None
    assigned_date: date | None = None
    expected_amount: Decimal | None
    committed_amount: Decimal | None = None
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
    requires_boq: bool = False
    requires_sow: bool = False
    boq_attached: bool = False
    sow_attached: bool = False
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
    sale_type: str | None = None
    notes: str | None
    convert_remark: str | None = None
    lost_reason: str | None = None
    customer_id: UUID | None
    converted_opportunity_id: UUID | None
    presales_owner_id: UUID | None = None
    presales_call_aligned: bool | None = None
    presales_call_contact_name: str | None = None
    presales_call_by_product: str | None = None
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
    custom_fields: dict[str, Any] | None = None


class OpportunityUpdate(BaseModel):
    opportunity_name: str | None = None
    current_stage: str | None = None
    expected_revenue: Decimal | None = None
    probability_percent: Decimal | None = None
    expected_close_date: date | None = None
    customer_id: UUID | None = None
    customer_mrr: Decimal | None = None
    customer_arr: Decimal | None = None
    customer_discount_percent: Decimal | None = None
    distributor_discount_percent: Decimal | None = None
    assessment_type: str | None = None
    migration_credit_phase1: Decimal | None = None
    migration_credit_phase2: Decimal | None = None
    migration_credit_phase3: Decimal | None = None
    marketing_event_id: UUID | None = None
    service_sourcing_channel: str | None = Field(
        default=None, pattern="^(Outsourced|Cache Service)$"
    )
    purchase_model: str | None = Field(default=None, pattern="^(capex|opex)$")
    lease_type: str | None = Field(default=None, pattern="^(finance|operating)$")
    lease_partner: str | None = Field(default=None, max_length=255)
    lease_interest_rate_pct: Decimal | None = Field(default=None, ge=0, le=100)
    lease_tenure_months: int | None = Field(default=None, ge=1, le=240)
    lease_monthly_rental: Decimal | None = Field(default=None, ge=0)
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
    boq_approved: bool = False
    sow_approved: bool = False
    oem_quote_attached: bool = False
    customer_po_attached: bool = False
    customer_po_approved: bool = False
    po_finance_status: str = "not_required"
    po_finance_remark: str | None = None
    po_finance_at: datetime | None = None
    po_terms_status: str = "not_required"
    po_terms_remark: str | None = None
    po_terms_at: datetime | None = None
    cloud_blueprint_variant: str | None = None
    product_type: str | None = None
    has_hardware: bool = False
    has_software: bool = False
    has_services: bool = False
    service_sourcing_channel: str | None = None
    cloud_sub_product: str | None = None
    customer_mrr: Decimal | None = None
    customer_arr: Decimal | None = None
    customer_discount_percent: Decimal | None = None
    distributor_discount_percent: Decimal | None = None
    profitability_percent: Decimal | None = None
    distributor_discount_locked: bool = False
    assessment_type: str | None = None
    migration_credit_phase1: Decimal | None = None
    migration_credit_phase2: Decimal | None = None
    migration_credit_phase3: Decimal | None = None
    contract_attached: bool = False
    onboarding_done: bool = False
    onboarding_date: date | None = None
    deal_reg_number: str | None = None
    sales_terms_accepted: bool = False
    sales_terms_accepted_at: datetime | None = None
    marketing_event_id: UUID | None = None
    purchase_model: str | None = None
    lease_type: str | None = None
    lease_partner: str | None = None
    lease_interest_rate_pct: Decimal | None = None
    lease_tenure_months: int | None = None
    lease_monthly_rental: Decimal | None = None
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
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("customer_name", "notes", "followup_type")
    @classmethod
    def reject_followup_markup(cls, value: str | None) -> str | None:
        if value is None:
            return None
        from shared.text_safety import assert_safe_plain_text

        return assert_safe_plain_text(value, field="value")


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
# Sales CRM (Zoho-replacement) - Company / Contact / Product / Quote / OVF /
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
    partner_names: str | None = None
    marketing_event_id: UUID | None = None
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
    custom_fields: dict[str, Any] | None = None

    @field_validator(
        "customer_name",
        "first_name",
        "last_name",
        "customer_email",
        "phone",
        "industry",
        "source",
        "account_type",
        "billing_street",
        "billing_city",
        "billing_state",
        "billing_code",
        "billing_country",
    )
    @classmethod
    def reject_company_markup(cls, value: str) -> str:
        from shared.text_safety import assert_safe_plain_text

        return assert_safe_plain_text(value, field="value")

    @field_validator(
        "other_industries",
        "portal_id",
        "partner_names",
        "rating",
        "website",
        "customer_id_ext",
        "role",
        "shipping_street",
        "shipping_city",
        "shipping_state",
        "shipping_code",
        "shipping_country",
        "description",
    )
    @classmethod
    def reject_optional_company_markup(cls, value: str | None) -> str | None:
        if value is None:
            return None
        from shared.text_safety import assert_safe_plain_text

        return assert_safe_plain_text(value, field="value")


class CompanyUpdate(BaseModel):
    customer_name: str | None = None
    account_owner_id: UUID | None = None
    account_type: str | None = None
    industry: str | None = None
    other_industries: str | None = None
    portal_id: str | None = None
    source: str | None = None
    partner_names: str | None = None
    marketing_event_id: UUID | None = None
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
    custom_fields: dict[str, Any] | None = None
    version: int | None = None

    @field_validator(
        "customer_name",
        "account_type",
        "industry",
        "other_industries",
        "portal_id",
        "source",
        "partner_names",
        "rating",
        "first_name",
        "last_name",
        "customer_email",
        "phone",
        "website",
        "customer_id_ext",
        "role",
        "billing_street",
        "billing_city",
        "billing_state",
        "billing_code",
        "billing_country",
        "shipping_street",
        "shipping_city",
        "shipping_state",
        "shipping_code",
        "shipping_country",
        "description",
        "status",
    )
    @classmethod
    def reject_company_markup(cls, value: str | None) -> str | None:
        if value is None:
            return None
        from shared.text_safety import assert_safe_plain_text

        return assert_safe_plain_text(value, field="value")


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
    partner_names: str | None
    marketing_event_id: UUID | None = None
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
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    version: int
    created_at: datetime | None = None


class ContactCreate(BaseModel):
    company_account_id: UUID
    branch_id: UUID
    first_name: str = Field(
        min_length=1,
        max_length=100,
        pattern=r"^[\w .'\-]{1,100}$",
    )
    last_name: str | None = Field(
        default=None,
        max_length=100,
        pattern=r"^[\w .'\-]{0,100}$",
    )
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40, pattern=r"^[\d +\-().]{0,40}$")
    mobile: str | None = Field(default=None, max_length=40, pattern=r"^[\d +\-().]{0,40}$")
    title: str | None = Field(default=None, max_length=120, pattern=r"^[\w .'\-/&]{0,120}$")
    is_primary: bool = False
    owner_id: UUID | None = None
    custom_fields: dict[str, Any] | None = None

    @field_validator("first_name", "last_name", "email", "phone", "mobile", "title")
    @classmethod
    def reject_contact_markup(cls, value: str | None) -> str | None:
        if value is None:
            return None
        from shared.text_safety import assert_safe_plain_text

        return assert_safe_plain_text(value, field="value")


class ContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    mobile: str | None = Field(default=None, max_length=40)
    title: str | None = Field(default=None, max_length=120)
    is_primary: bool | None = None
    status: str | None = None
    custom_fields: dict[str, Any] | None = None
    version: int | None = None

    @field_validator("first_name", "last_name", "email", "phone", "mobile", "title", "status")
    @classmethod
    def reject_contact_markup(cls, value: str | None) -> str | None:
        if value is None:
            return None
        from shared.text_safety import assert_safe_plain_text

        return assert_safe_plain_text(value, field="value")


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
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    version: int


class LeadCreateFromCompany(BaseModel):
    """Body for POST /crm/companies/{id}/leads - the only sales-lead entry point."""

    branch_id: UUID
    first_name: str | None = None
    last_name: str | None = None
    salutation: str | None = None
    designation: str = Field(min_length=1)
    mobile: str | None = None
    email: str | None = None
    lead_source_id: UUID
    partner_names: str | None = None
    marketing_event_id: UUID | None = None
    owner_employee_id: UUID | None = None
    assign_to_id: UUID | None = None
    assigned_date: date | None = None
    expected_amount: Decimal | None = None
    committed_amount: Decimal | None = None
    expected_closure_date: date | None = None
    product_type: str | None = None
    sub_product_category: str = Field(min_length=1)
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
    sale_type: str | None = None
    entity_name: str | None = None
    entity_email: str | None = None
    entity_address: str | None = None
    entity_gst: str | None = None
    entity_contact: str | None = None
    requires_boq: bool = False
    requires_sow: bool = False
    notes: str | None = None
    presales_owner_id: UUID | None = None
    presales_call_aligned: bool | None = None
    presales_call_contact_name: str | None = None
    presales_call_by_product: str | None = None
    custom_fields: dict[str, Any] | None = None


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
    designation: str | None = None
    lead_source_id: UUID | None = None
    partner_names: str | None = None
    marketing_event_id: UUID | None = None
    status: str
    blueprint_state: str
    locked: bool
    company_account_id: UUID | None
    owner_employee_id: UUID
    assign_to_id: UUID | None
    expected_amount: Decimal | None
    committed_amount: Decimal | None = None
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
    requires_boq: bool = False
    requires_sow: bool = False
    boq_attached: bool = False
    sow_attached: bool = False
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
    sale_type: str | None = None
    notes: str | None = None
    converted_opportunity_id: UUID | None
    presales_owner_id: UUID | None = None
    presales_call_aligned: bool | None = None
    presales_call_contact_name: str | None = None
    presales_call_by_product: str | None = None
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    version: int


class ProductCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company_id: UUID | None = None
    product_code: str | None = Field(default=None, max_length=50, pattern=r"^[^<>]{0,50}$")
    product_name: str = Field(min_length=1, max_length=255, pattern=r"^[^<>]{1,255}$")
    product_type: str = Field(min_length=1, max_length=20, pattern="^(hardware|software|services)$")
    hsn_sac: str | None = Field(default=None, max_length=20, pattern=r"^[A-Za-z0-9./\-]{0,20}$")
    unit_price: Decimal = Field(default=Decimal("0"), ge=0, le=Decimal("99999999999999.9999"))
    status: str = Field(default="active", max_length=30, pattern="^(active|inactive)$")


class ProductUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_name: str | None = Field(default=None, min_length=1, max_length=255)
    hsn_sac: str | None = Field(default=None, max_length=20)
    unit_price: Decimal | None = Field(default=None, ge=0, le=Decimal("99999999999999.9999"))
    status: str | None = Field(default=None, max_length=30, pattern="^(active|inactive)$")
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


class SellingEntityCreate(BaseModel):
    company_id: UUID | None = None
    entity_code: str | None = None
    entity_name: str
    entity_email: str | None = None
    entity_contact: str | None = None
    entity_gst: str | None = None
    entity_address: str | None = None
    status: str = "active"


class SellingEntityUpdate(BaseModel):
    entity_name: str | None = None
    entity_email: str | None = None
    entity_contact: str | None = None
    entity_gst: str | None = None
    entity_address: str | None = None
    status: str | None = None
    version: int | None = None


class SellingEntityResponse(OrmModel):
    id: UUID
    company_id: UUID
    entity_code: str
    entity_name: str
    entity_email: str | None
    entity_contact: str | None
    entity_gst: str | None
    entity_address: str | None
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
    amc_warranty: str | None = None
    amc_start_date: date | None = None
    amc_end_date: date | None = None
    billing_street: str | None = None
    billing_city: str | None = None
    billing_state: str | None = None
    billing_zip: str | None = None
    billing_country: str | None = None
    shipping_street: str | None = None
    shipping_city: str | None = None
    shipping_state: str | None = None
    shipping_zip: str | None = None
    shipping_country: str | None = None
    freight: Decimal = Decimal("0")
    terms: str | None = None
    description: str | None = None
    reason_for_discount: str | None = None
    custom_fields: dict[str, Any] | None = None


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
    amc_warranty: str | None = None
    amc_start_date: date | None = None
    amc_end_date: date | None = None
    billing_street: str | None = None
    billing_city: str | None = None
    billing_state: str | None = None
    billing_zip: str | None = None
    billing_country: str | None = None
    shipping_street: str | None = None
    shipping_city: str | None = None
    shipping_state: str | None = None
    shipping_zip: str | None = None
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
    amc_warranty: str | None = None
    amc_start_date: date | None = None
    amc_end_date: date | None = None
    billing_street: str | None = None
    billing_city: str | None = None
    billing_state: str | None = None
    billing_zip: str | None = None
    billing_country: str | None
    shipping_street: str | None = None
    shipping_city: str | None = None
    shipping_state: str | None = None
    shipping_zip: str | None = None
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
    parent_quote_id: UUID | None = None
    version: int
    created_at: datetime | None = None


class VendorQuoteExtractRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_base64: str = Field(min_length=1)


class VendorQuoteExtractLine(BaseModel):
    product_name: str
    hsn_sac: str | None = None
    qty: Decimal
    unit_cost: Decimal
    line_total: Decimal
    gst_pct: Decimal | None = None


class VendorQuoteExtractResponse(BaseModel):
    lines: list[VendorQuoteExtractLine] = Field(default_factory=list)
    text_extracted: bool = False
    ocr_available: bool = False


class QuoteSplitLine(BaseModel):
    source_line_id: UUID
    qty: Decimal = Field(gt=0)


class QuoteSplitItem(BaseModel):
    contact_id: UUID | None = None
    entity_name: str | None = Field(default=None, max_length=255)
    entity_gst: str | None = Field(default=None, max_length=30)
    entity_address: str | None = None
    shipping_street: str | None = Field(default=None, max_length=255)
    shipping_city: str | None = Field(default=None, max_length=100)
    shipping_state: str | None = Field(default=None, max_length=100)
    shipping_zip: str | None = Field(default=None, max_length=20)
    lines: list[QuoteSplitLine] = Field(min_length=1)


class QuoteSplitRequest(BaseModel):
    splits: list[QuoteSplitItem] = Field(min_length=2, max_length=50)


class QuoteSplitBalanceRow(BaseModel):
    line_id: UUID
    line_no: int
    product_name: str
    qty: Decimal
    allocated_qty: Decimal
    balance_qty: Decimal


class QuoteLineCreate(BaseModel):
    product_id: UUID | None = None
    product_name: str
    hsn_sac: str | None = None
    description: str | None = None
    sub_product_category: str | None = None
    line_type: str = "hardware"
    qty: Decimal = Decimal("1")
    unit_cost: Decimal = Decimal("0")
    unit_sell: Decimal = Decimal("0")
    # Optional entered markup % (up to 10 d.p.); when set with unit_cost, drives unit_sell.
    margin_pct: Decimal | None = None
    gst_pct: Decimal = Decimal("0")


class QuoteLineUpdate(BaseModel):
    product_name: str | None = None
    hsn_sac: str | None = None
    description: str | None = None
    sub_product_category: str | None = None
    line_type: str | None = None
    qty: Decimal | None = None
    unit_cost: Decimal | None = None
    unit_sell: Decimal | None = None
    margin_pct: Decimal | None = None
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
    sub_product_category: str | None = None
    line_type: str
    qty: Decimal
    unit_cost: Decimal
    unit_sell: Decimal
    margin_pct: Decimal
    margin_amount: Decimal
    gst_pct: Decimal
    gst_amount: Decimal
    line_total: Decimal
    source_line_id: UUID | None = None
    version: int


class QuoteMarginSummaryResponse(BaseModel):
    quote_id: UUID
    avg_margin_pct: Decimal
    total_margin_amount: Decimal
    total_sell_amount: Decimal
    required_threshold_pct: Decimal
    requires_management_approval: bool
    line_types_present: list[str]


class QuoteRevisionRow(BaseModel):
    revision_no: int
    avg_margin_pct: Decimal
    grand_total: Decimal
    total_margin_amount: Decimal
    negotiation_pct: Decimal
    is_current: bool = False
    snapshotted_at: datetime | None = None
    remark: str | None = None
    has_print_payload: bool = False


class QuoteRevisionPrintPayload(BaseModel):
    revision_no: int
    is_current: bool = False
    quote: dict[str, Any]
    lines: list[dict[str, Any]]


class QuoteSendForApprovalRequest(BaseModel):
    team_role: str = "management"
    assigned_user_id: UUID | None = None
    assigned_user_ids: list[UUID] | None = None
    remarks: str | None = None
    quotation_pdf_base64: str | None = None
    quotation_pdf_filename: str | None = None


class QuoteActionRequest(BaseModel):
    remark: str | None = None
    valid_until: date | None = None


class OvfCreate(BaseModel):
    quote_id: UUID
    branch_id: UUID
    po_number: str | None = None
    po_date: date | None = None
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
    delivery_weeks_min: int | None = Field(default=None, ge=1, le=260)
    delivery_weeks_max: int | None = Field(default=None, ge=1, le=260)
    negotiated_by: str | None = Field(default=None, max_length=50)
    negotiation_remark: str | None = None
    early_payment_discount_pct: Decimal | None = None
    custom_fields: dict[str, Any] | None = None


class OvfUpdate(BaseModel):
    po_number: str | None = None
    po_date: date | None = None
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
    delivery_weeks_min: int | None = Field(default=None, ge=1, le=260)
    delivery_weeks_max: int | None = Field(default=None, ge=1, le=260)
    negotiated_by: str | None = Field(default=None, max_length=50)
    negotiation_remark: str | None = None
    early_payment_discount_pct: Decimal | None = None
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
    po_date: date | None = None
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
    shared_to_scm_at: datetime | None = None
    deal_won: bool
    deal_won_amount: Decimal | None
    vendor_payment_days: int
    customer_payment_days: int
    finance_cost_pct: Decimal
    additional_charges: Decimal
    freight: Decimal
    total_margin_pct: Decimal
    total_margin_amount: Decimal
    # Invoice routing + AR follow-up. Supply-chain negotiation savings are
    # deliberately absent here: Sales must never see them (see OvfScmSavingsResponse).
    invoice_channel: str | None = None
    invoice_submitted_portal: bool = False
    invoice_submitted_at: datetime | None = None
    invoice_reference: str | None = None
    payment_due_date: date | None = None
    payment_received_date: date | None = None
    payment_delay_reason: str | None = None
    margin_at_approval_amount: Decimal | None = None
    margin_at_approval_pct: Decimal | None = None
    execution_expense_total: Decimal = Decimal("0")
    overdue_finance_cost: Decimal = Decimal("0")
    holding_cost: Decimal = Decimal("0")
    early_payment_discount_pct: Decimal = Decimal("0")
    live_margin_amount: Decimal | None = None
    live_margin_pct: Decimal | None = None
    live_margin_as_of: datetime | None = None
    full_payment_received: bool = False
    closed_at: datetime | None = None
    delivery_weeks_min: int | None = None
    delivery_weeks_max: int | None = None
    expected_delivery_date: date | None = None
    actual_delivery_date: date | None = None
    delivery_date_history: list[dict] | None = None
    negotiated_by: str | None = None
    negotiation_remark: str | None = None
    original_vendor_total: Decimal | None = None
    freight_medium: str | None = None
    freight_weight_kg: Decimal | None = None
    freight_insurance: bool = False
    version: int
    created_at: datetime | None = None


class OvfFreightRequest(BaseModel):
    medium: str | None = Field(default=None, max_length=20)
    weight_kg: Decimal | None = Field(default=None, ge=0)
    insurance: bool | None = None
    remarks: str | None = None


class OvfSupportingItemInput(BaseModel):
    line_id: UUID | None = None
    product_name: str = Field(default="", max_length=255)
    qty: Decimal = Field(default=Decimal("1"), gt=0)
    unit_price: Decimal = Field(ge=0)
    distributor_name: str | None = Field(default=None, max_length=255)
    description: str | None = None


class OvfSupportingItemsRequest(BaseModel):
    remarks: str | None = None


class OvfServicePlanInput(BaseModel):
    """My Jobs payload: create a per-visit service plan for an OVF."""

    rate_contract_id: UUID
    projected_visits: int = Field(gt=0)
    consumables_amount: Decimal = Field(default=Decimal("0"), ge=0)
    description: str | None = None


class OvfServiceVisitsRequest(BaseModel):
    remarks: str | None = None


class OvfDeliveryDatesUpdate(BaseModel):
    expected_delivery_date: date | None = None
    actual_delivery_date: date | None = None
    reason: str | None = None


class OvfVendorSplitItem(BaseModel):
    distributor_name: str = Field(min_length=1, max_length=255)
    qty: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)
    gst_pct: Decimal | None = None
    description: str | None = None
    contact_person: str | None = None
    contact_number: str | None = None


class OvfVendorSplitRequest(BaseModel):
    customer_line_id: UUID
    splits: list[OvfVendorSplitItem] = Field(min_length=1)


class OvfPaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    received_date: date
    reference: str | None = Field(default=None, max_length=120)
    remark: str | None = None


class OvfPaymentResponse(OrmModel):
    id: UUID
    ovf_id: UUID
    amount: Decimal
    received_date: date
    reference: str | None = None
    remark: str | None = None
    created_at: datetime | None = None
    created_by: UUID | None = None


class OvfFullPaymentRequest(BaseModel):
    received_date: date
    remark: str | None = None


class OvfExpenseCreate(BaseModel):
    expense_type: str = Field(max_length=30)
    raised_by_team: str = Field(max_length=20)
    description: str = Field(min_length=1)
    amount: Decimal = Field(gt=0)
    incurred_on: date | None = None


class OvfExpenseDecisionRequest(BaseModel):
    decision: str
    remark: str | None = None


class OvfExpenseResponse(OrmModel):
    id: UUID
    ovf_id: UUID
    expense_type: str
    raised_by_team: str
    description: str
    amount: Decimal
    incurred_on: date | None = None
    status: str
    decided_by: UUID | None = None
    decided_at: datetime | None = None
    decision_remark: str | None = None
    created_at: datetime | None = None
    created_by: UUID | None = None


class OvfLiveStatusResponse(BaseModel):
    ovf_id: UUID
    ovf_no: str
    as_of: date
    margin_at_approval_amount: Decimal | None = None
    margin_at_approval_pct: Decimal | None = None
    live_margin_amount: Decimal
    live_margin_pct: Decimal
    margin_erosion: Decimal | None = None
    customer_total: Decimal
    customer_receivable: Decimal
    vendor_total: Decimal
    received_amount: Decimal
    outstanding_amount: Decimal
    overdue_days: int
    overdue_finance_cost: Decimal
    holding_cost: Decimal
    execution_expense_total: Decimal
    early_payment_saving: Decimal
    planned_finance_cost: Decimal
    full_payment_received: bool
    closed_at: datetime | None = None
    payment_due_date: date | None = None
    payment_received_date: date | None = None
    expected_delivery_date: date | None = None
    actual_delivery_date: date | None = None
    delivery_overdue: bool = False


class SalesPerformanceRow(BaseModel):
    owner_employee_id: UUID | None = None
    owner_name: str | None = None
    ovf_count: int
    open_ovf_count: int
    margin_at_approval: Decimal
    live_margin: Decimal
    margin_erosion: Decimal
    overdue_finance_cost: Decimal
    holding_cost: Decimal
    execution_expenses: Decimal
    outstanding_receivable: Decimal


class CompanyGstCreate(BaseModel):
    gstin: str = Field(min_length=15, max_length=15, pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    location_label: str | None = Field(default=None, max_length=255)
    billing_address: str | None = None
    shipping_address: str | None = None
    is_head_office: bool = False
    certificate_attachment_id: UUID | None = None


class CompanyGstUpdate(BaseModel):
    location_label: str | None = Field(default=None, max_length=255)
    billing_address: str | None = None
    shipping_address: str | None = None
    is_head_office: bool | None = None
    certificate_attachment_id: UUID | None = None
    status: str | None = None
    version: int | None = None


class CompanyGstResponse(OrmModel):
    id: UUID
    company_account_id: UUID
    gstin: str
    state_code: str | None = None
    state: str | None = None
    location_label: str | None = None
    billing_address: str | None = None
    shipping_address: str | None = None
    is_head_office: bool
    certificate_attachment_id: UUID | None = None
    source: str
    status: str
    created_at: datetime | None = None
    version: int


class CustomerPoExtractRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_base64: str = Field(min_length=1)
    capture_gst: bool = True


class CustomerPoGstHit(BaseModel):
    gstin: str
    state_code: str | None = None
    state: str | None = None
    id: UUID | None = None
    is_new: bool | None = None


class CustomerPoExtractResponse(BaseModel):
    po_number: str | None = None
    po_date: date | None = None
    billing_address: str | None = None
    shipping_address: str | None = None
    gst_registrations: list[CustomerPoGstHit] = Field(default_factory=list)
    delivery_weeks_min: int | None = None
    delivery_weeks_max: int | None = None
    fields_found: list[str] = Field(default_factory=list)
    text_extracted: bool = False


class CustomerExpenseCreate(BaseModel):
    expense_date: date
    category: str = Field(max_length=30)
    description: str = Field(min_length=1)
    amount: Decimal = Field(gt=0)
    opportunity_id: UUID | None = None
    approved_by_name: str = Field(min_length=1, max_length=255)
    approval_reference: str | None = None
    adjust_in_future: bool = True


class CustomerExpenseAdjustRequest(BaseModel):
    ovf_id: UUID
    remark: str | None = None


class CustomerExpenseWriteOffRequest(BaseModel):
    remark: str = Field(min_length=1)


class CustomerExpenseResponse(OrmModel):
    id: UUID
    company_account_id: UUID
    opportunity_id: UUID | None = None
    expense_date: date
    category: str
    description: str
    amount: Decimal
    approved_by_name: str | None = None
    approval_reference: str | None = None
    adjust_in_future: bool
    status: str
    adjusted_ovf_id: UUID | None = None
    adjusted_at: datetime | None = None
    adjustment_remark: str | None = None
    created_at: datetime | None = None


class CustomerExpenseSummaryResponse(BaseModel):
    company_account_id: UUID | None = None
    open_count: int
    open_amount: Decimal
    adjusted_amount: Decimal
    written_off_amount: Decimal
    open_items: list[CustomerExpenseResponse] = Field(default_factory=list)


class OvfScmSavingsResponse(BaseModel):
    """Supply-chain negotiation savings - Management / SCM only, never Sales."""

    ovf_id: UUID
    ovf_no: str
    scm_savings_amount: Decimal
    scm_negotiated_vendor_total: Decimal | None = None


class OvfInvoiceSubmissionRequest(BaseModel):
    """Record the customer invoice submission (portal for SAC, physical for HSN)."""

    invoice_reference: str | None = Field(default=None, max_length=100)
    submitted_on_portal: bool = True
    payment_due_date: date | None = None


class OvfPaymentUpdateRequest(BaseModel):
    payment_received_date: date | None = None
    payment_due_date: date | None = None
    payment_delay_reason: str | None = None


class OvfInvoiceStatusResponse(BaseModel):
    """HSN vs SAC invoice routing and the AR follow-up state for one OVF."""

    ovf_id: UUID
    ovf_no: str
    customer_name: str | None = None
    invoice_channel: str | None = None
    portal_submission_required: bool = False
    physical_delivery_invoice: bool = False
    hsn_line_count: int = 0
    sac_line_count: int = 0
    invoice_submitted_portal: bool = False
    invoice_submitted_at: datetime | None = None
    invoice_reference: str | None = None
    payment_due_date: date | None = None
    payment_received_date: date | None = None
    payment_delay_reason: str | None = None
    payment_delay_days: int = 0
    payment_status: str = "not_invoiced"


class OvfLineCreate(BaseModel):
    side: str = "customer_po"
    source_line_id: UUID | None = None
    product_name: str
    description: str | None = None
    distributor_name: str | None = None
    contact_person: str | None = None
    contact_number: str | None = None
    qty: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    gst_pct: Decimal | None = None
    line_total: Decimal | None = None


class OvfLineUpdate(BaseModel):
    product_name: str | None = None
    description: str | None = None
    distributor_name: str | None = None
    contact_person: str | None = None
    contact_number: str | None = None
    qty: Decimal | None = None
    unit_price: Decimal | None = None
    gst_pct: Decimal | None = None
    line_total: Decimal | None = None
    version: int | None = None


class OvfLineResponse(OrmModel):
    id: UUID
    ovf_id: UUID
    side: str
    line_no: int
    product_name: str
    description: str | None = None
    distributor_name: str | None = None
    contact_person: str | None = None
    contact_number: str | None = None
    qty: Decimal
    unit_price: Decimal
    gst_pct: Decimal = Decimal("18")
    line_total: Decimal
    source_line_id: UUID | None = None
    version: int


class OvfSendForApprovalRequest(BaseModel):
    team_role: str = "management"
    assigned_user_id: UUID | None = None
    assigned_user_ids: list[UUID] | None = None
    remarks: str | None = None
    ovf_pdf_base64: str | None = None
    ovf_pdf_filename: str | None = None


class OvfDealWonRequest(BaseModel):
    deal_won_amount: Decimal


class AttachmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entity_type: str = Field(min_length=1, max_length=50)
    entity_id: UUID
    branch_id: UUID
    company_id: UUID | None = None
    file_name: str = Field(min_length=1, max_length=255)
    category: str = Field(default="other", max_length=50)
    source: str = Field(default="upload", pattern="^(upload|link|google_drive|onedrive|dropbox|box)$")
    file_path: str | None = Field(default=None, max_length=1000)
    content_base64: str | None = None
    content_type: str | None = Field(default=None, max_length=255)


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

    @field_serializer("file_path")
    def _safe_file_path(self, value: str) -> str:
        """Never expose absolute filesystem paths (AppScan path disclosure)."""
        text = (value or "").strip()
        if not text:
            return ""
        lower = text.lower()
        if lower.startswith(("http://", "https://", "db://")):
            return text
        return ""


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
    response_due_at: datetime | None = None
    responded_at: datetime | None = None
    response: str | None = None
    response_reason: str | None = None
    escalated_at: datetime | None = None
    escalation_level: int = 0
    created_at: datetime | None = None


class ApprovalTaskRespondRequest(BaseModel):
    can_submit: bool
    reason: str | None = None


class CrmApprovalUserOption(BaseModel):
    id: UUID
    display_name: str
    email: str


class CrmMemberOption(BaseModel):
    """Selectable CRM team member (master_employee id for owner/assignee fields)."""

    id: UUID
    label: str
    email: str
    user_id: UUID


class ApprovalTaskDecisionRequest(BaseModel):
    decision: str = Field(pattern="^(approved|rejected)$")
    remark: str | None = None
    freight: Decimal | None = None
    freight_medium: str | None = None
    freight_weight_kg: Decimal | None = None
    freight_insurance: bool | None = None
    supporting_items: list[OvfSupportingItemInput] | None = None
    service_plan: OvfServicePlanInput | None = None
    file_name: str | None = None
    content_base64: str | None = None
    content_type: str | None = None
    file_path: str | None = None


class PoValidationStageResponse(BaseModel):
    status: str = "not_required"
    remark: str | None = None
    decided_at: datetime | None = None


class PoValidationResponse(BaseModel):
    """Finance → Legal (terms) → Management validation of the customer PO."""

    finance: PoValidationStageResponse
    legal: PoValidationStageResponse
    management: PoValidationStageResponse


class BlueprintStateResponse(BaseModel):
    entity_type: str
    entity_id: UUID
    state: str
    locked: bool
    allowed_actions: list[str]
    is_sales_blueprint: bool | None = None
    po_validation: PoValidationResponse | None = None


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
    # Selected My Jobs recipients for "Sent for Approval" milestones.
    assignee_names: list[str] = []
    decision: str | None = None
    team_role: str | None = None
    remark: str | None = None
    version: int | None = None


class OpportunityTimelineResponse(BaseModel):
    opportunity_id: UUID
    opportunity_code: str | None = None
    opportunity_name: str | None = None
    events: list[OpportunityTimelineEventResponse]


class DealTimelineListItem(BaseModel):
    opportunity_id: UUID
    opportunity_code: str | None = None
    opportunity_name: str | None = None
    customer_name: str | None = None
    account_name: str | None = None
    stage: str | None = None
    status: str | None = None
    # Coarse lifecycle phase: crm | ovf | scm | delivery | project | completed | lost
    phase: str
    timeline_status: str
    deal_won: bool = False
    updated_at: datetime | None = None


class DealTimelineResponse(BaseModel):
    opportunity_id: UUID
    opportunity_code: str | None = None
    opportunity_name: str | None = None
    customer_name: str | None = None
    timeline_status: str
    events: list[OpportunityTimelineEventResponse]


class BlueprintActionRequest(BaseModel):
    """Generic action payload - fields are action-specific and all optional.

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
    onboarding_date: date | None = None
    assigned_user_id: UUID | None = None
    assigned_user_ids: list[UUID] | None = None
    # Per-stage approvers for the customer PO chain (send_po_approval). When
    # omitted, ``assigned_user_ids`` is used for every stage.
    finance_user_ids: list[UUID] | None = None
    legal_user_ids: list[UUID] | None = None
    management_user_ids: list[UUID] | None = None
    # Operations owners notified of the services/installation scope as soon as
    # the customer PO is approved (optional - only used when the PO has SAC lines).
    operations_user_ids: list[UUID] | None = None
    # send_po_approval: Sales confirms they checked and verified the PO T&C.
    terms_accepted: bool | None = None
    # Accepted quote print PDF attached to PO approval emails.
    quotation_pdf_base64: str | None = None
    quotation_pdf_filename: str | None = None

    def to_payload(self) -> dict:
        return self.model_dump(exclude_none=True)


class KycRecordCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    company_account_id: UUID
    owner_employee_id: UUID
    quote_id: UUID | None = None
    form_data: dict = Field(default_factory=dict)


class KycRecordUpdate(BaseModel):
    owner_employee_id: UUID | None = None
    quote_id: UUID | None = None
    form_data: dict | None = None
    status: str | None = None


class KycRecordResponse(OrmModel):
    id: UUID
    kyc_code: str
    company_account_id: UUID
    owner_employee_id: UUID
    quote_id: UUID | None
    form_data: dict
    status: str
    company_id: UUID
    branch_id: UUID
    version: int


# --- Custom / saved reports ---


class SavedReportCreate(BaseModel):
    report_name: str
    primary_module: str
    columns: list[str]
    folder_name: str | None = None
    description: str | None = None
    company_id: UUID | None = None


class SavedReportUpdate(BaseModel):
    report_name: str | None = None
    columns: list[str] | None = None
    folder_name: str | None = None
    description: str | None = None
    version: int | None = None


class SavedReportCloneRequest(BaseModel):
    report_name: str | None = None


class SavedReportResponse(OrmModel):
    id: UUID
    report_code: str
    report_name: str
    primary_module: str
    folder_name: str | None
    description: str | None
    definition_json: dict
    owner_user_id: UUID
    status: str
    company_id: UUID
    version: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ReportRunRequest(BaseModel):
    primary_module: str
    columns: list[str]
    company_id: UUID | None = None
    preview_limit: int | None = None


class ReportRunResponse(BaseModel):
    columns: list[dict]
    rows: list[dict]
    record_count: int
    primary_module: str
    module_label: str
