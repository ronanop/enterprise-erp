"""Pydantic schemas for Service Request Ticket Management (SOP)."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from modules.service.domain.ticket_status import status_label as _status_label


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Nested section payloads ---

class FieldEngineerVisitPayload(BaseModel):
    engineer_name: str | None = None
    engineer_contact: str | None = None
    distance: str | None = None
    visits_count: int | None = None
    # None = "not provided" so partial updates never reset the stored value
    carrying_spares: bool | None = None
    visit_date: date | None = None
    hw_replacement: str | None = None
    hardware_repair: str | None = Field(None, max_length=10)  # yes / no
    hardware_replacement_yn: str | None = Field(None, max_length=10)  # yes / no
    new_device_serial: str | None = Field(None, max_length=100)
    transport_mode: str | None = None
    movement_charges: Decimal | None = None
    visit_charges: Decimal | None = None
    other_charges: Decimal | None = None
    # total = visit + movement + other (server recomputes when any component is present)
    total_charges: Decimal | None = None
    remarks: str | None = None
    payment_approval: str | None = None
    # Read-only append log; ignored on input
    visit_notes_history: str | None = None


class OemSupportPayload(BaseModel):
    oem_name: str | None = None
    oem_ticket_number: str | None = None
    customer_reference: str | None = None
    ticket_type: str | None = None
    oem_engineer_contact: str | None = None
    tac_response_summary: str | None = None
    tac_resolution: str | None = None
    oem_status: str | None = None
    last_checked_at: datetime | None = None


class ServiceRequestTicketCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    category_id: UUID
    customer_id: UUID

    mode_of_action: str | None = None
    service_type: str = Field(..., min_length=1)
    subject: str = Field(..., min_length=1)
    contact_name: str = Field(..., min_length=1)
    status: str = "ticket_registered"
    priority: str = Field(..., min_length=1)
    channel: str = Field(..., min_length=1)
    ticket_category: str | None = None
    sla_status: str = "within_sla"

    email: str | None = None
    alternate_email: str | None = None
    mobile: str | None = None
    owner_employee_id: UUID | None = None
    product_id: UUID | None = None
    contact_id: UUID | None = None
    master_asset_id: UUID | None = None

    software_version: str | None = None
    issue_description: str | None = None
    description: str | None = None

    reference_sr_number: str | None = None
    customer_reference: str | None = None
    lsi: str | None = None
    ckt_id: str | None = None

    end_customer_name: str | None = None
    end_customer_email: str | None = None
    coordinator_name: str | None = None
    coordinator_phone: str | None = None
    end_customer_street: str | None = None
    end_customer_state: str | None = None
    end_customer_city: str | None = None
    end_customer_city_type: str | None = None
    end_customer_other_city: str | None = None
    end_customer_gst: str | None = None
    end_customer_postal_code: str | None = None

    start_work_date: datetime | None = None
    due_at: datetime | None = None
    classification: str | None = None
    escalation_reason: str | None = None
    next_plan: str | None = None
    additional_description: str | None = None
    oem_support_enabled: bool = False

    asset_name: str | None = None
    serial_number: str | None = None
    warranty_start_date: date | None = None
    warranty_end_date: date | None = None
    amc_end_date: date | None = None
    asset_status: str | None = None
    amc_mail_sent: bool = False
    asset_confirmed_at: datetime | None = None

    remote_engineer_name: str | None = None
    remote_engineer_contact: str | None = None
    remote_engineer_date: date | None = None
    follow_up_at: datetime | None = None
    follow_up_note: str | None = None

    site_availability: str | None = None
    site_instructions: str | None = None
    link_type: str | None = None
    bandwidth: str | None = None
    ports_in_use: str | None = None
    previous_fe_notes: str | None = None
    ip_details: str | None = None
    mail_extra_info: str | None = None
    company_name_from_mail: str | None = None
    present_type: str | None = None
    field_manual_overrides: dict[str, bool] | None = None

    field_engineer: FieldEngineerVisitPayload | None = None
    oem_support: OemSupportPayload | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "ServiceRequestTicketCreate":
        if (
            self.warranty_start_date
            and self.warranty_end_date
            and self.warranty_end_date < self.warranty_start_date
        ):
            raise ValueError("Warranty end date cannot be before warranty start date")
        if self.start_work_date and self.due_at and self.due_at < self.start_work_date:
            raise ValueError("Due date cannot be before start work date")
        return self


class ServiceRequestTicketUpdate(BaseModel):
    version: int | None = None
    mode_of_action: str | None = None
    service_type: str | None = None
    subject: str | None = None
    contact_name: str | None = None
    status: str | None = None
    priority: str | None = None
    channel: str | None = None
    ticket_category: str | None = None
    sla_status: str | None = None
    category_id: UUID | None = None
    customer_id: UUID | None = None
    email: str | None = None
    alternate_email: str | None = None
    mobile: str | None = None
    owner_employee_id: UUID | None = None
    product_id: UUID | None = None
    contact_id: UUID | None = None
    master_asset_id: UUID | None = None
    software_version: str | None = None
    issue_description: str | None = None
    description: str | None = None
    reference_sr_number: str | None = None
    customer_reference: str | None = None
    lsi: str | None = None
    ckt_id: str | None = None
    end_customer_name: str | None = None
    end_customer_email: str | None = None
    coordinator_name: str | None = None
    coordinator_phone: str | None = None
    end_customer_street: str | None = None
    end_customer_state: str | None = None
    end_customer_city: str | None = None
    end_customer_city_type: str | None = None
    end_customer_other_city: str | None = None
    end_customer_gst: str | None = None
    end_customer_postal_code: str | None = None
    start_work_date: datetime | None = None
    due_at: datetime | None = None
    classification: str | None = None
    escalation_reason: str | None = None
    next_plan: str | None = None
    additional_description: str | None = None
    oem_support_enabled: bool | None = None
    asset_name: str | None = None
    serial_number: str | None = None
    warranty_start_date: date | None = None
    warranty_end_date: date | None = None
    amc_end_date: date | None = None
    asset_status: str | None = None
    amc_mail_sent: bool | None = None
    asset_confirmed_at: datetime | None = None
    remote_engineer_name: str | None = None
    remote_engineer_contact: str | None = None
    remote_engineer_date: date | None = None
    follow_up_at: datetime | None = None
    follow_up_note: str | None = None
    site_availability: str | None = None
    site_instructions: str | None = None
    link_type: str | None = None
    bandwidth: str | None = None
    ports_in_use: str | None = None
    previous_fe_notes: str | None = None
    ip_details: str | None = None
    mail_extra_info: str | None = None
    company_name_from_mail: str | None = None
    issue_reported_code: str | None = Field(None, max_length=80)
    resolution_comment_code: str | None = Field(None, max_length=80)
    other_remarks: str | None = None
    present_type: str | None = None
    field_manual_overrides: dict[str, bool] | None = None
    field_engineer: FieldEngineerVisitPayload | None = None
    oem_support: OemSupportPayload | None = None


class ServiceRequestTicketListItem(OrmModel):
    id: UUID
    document_number: str
    subject: str
    contact_name: str | None
    customer_id: UUID
    priority: str
    status: str
    owner_employee_id: UUID | None
    mode_of_action: str | None
    created_at: datetime
    due_at: datetime | None
    ticket_category: str | None
    channel: str | None
    company_id: UUID
    branch_id: UUID
    version: int
    reopened_at: datetime | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def status_label(self) -> str:
        return _status_label(self.status, self.reopened_at)


class ServiceRequestTicketDetail(ServiceRequestTicketListItem):
    category_id: UUID
    service_type: str
    email: str | None
    alternate_email: str | None
    mobile: str | None
    product_id: UUID | None
    contact_id: UUID | None
    master_asset_id: UUID | None
    software_version: str | None
    issue_description: str | None
    description: str | None
    sla_id: UUID | None
    sla_status: str | None
    reference_sr_number: str | None
    customer_reference: str | None
    lsi: str | None
    ckt_id: str | None = None
    end_customer_name: str | None
    end_customer_email: str | None
    coordinator_name: str | None
    coordinator_phone: str | None
    end_customer_street: str | None
    end_customer_state: str | None
    end_customer_city: str | None
    end_customer_city_type: str | None
    end_customer_other_city: str | None
    end_customer_gst: str | None
    end_customer_postal_code: str | None
    start_work_date: datetime | None
    classification: str | None
    escalation_reason: str | None
    next_plan: str | None
    additional_description: str | None
    oem_support_enabled: bool
    asset_name: str | None
    serial_number: str | None
    warranty_start_date: date | None
    warranty_end_date: date | None
    amc_end_date: date | None
    asset_status: str | None
    amc_mail_sent: bool
    asset_confirmed_at: datetime | None = None
    asset_confirmed_by: UUID | None = None
    remote_engineer_name: str | None = None
    remote_engineer_contact: str | None = None
    remote_engineer_date: date | None = None
    follow_up_at: datetime | None = None
    follow_up_note: str | None = None
    site_availability: str | None = None
    site_instructions: str | None = None
    link_type: str | None = None
    bandwidth: str | None = None
    ports_in_use: str | None = None
    previous_fe_notes: str | None = None
    ip_details: str | None = None
    mail_extra_info: str | None = None
    company_name_from_mail: str | None = None
    present_type: str | None = None
    field_manual_overrides: dict[str, bool] | None = None
    issue_reported_code: str | None = None
    resolution_comment_code: str | None = None
    other_remarks: str | None = None
    sla_target_minutes: int | None = None
    sla_policy_snapshot: dict | None = None
    sla_remaining_minutes: int | None = None
    sla_elapsed_minutes: int | None = None
    sla_breached: bool | None = None
    sla_paused_at: datetime | None = None
    sla_paused_total_minutes: int = 0
    sla_is_paused: bool = False
    sla_pauses: list["ServiceRequestSlaPauseItem"] = []
    pending_reopen_request: "ServiceRequestReopenRequestResponse | None" = None
    field_engineer: FieldEngineerVisitPayload | None = None
    oem_support: OemSupportPayload | None = None
    solution_summary: str | None = None
    solution_type: str | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    ownership_locked: bool = False
    opened_at: datetime | None = None
    opened_by: UUID | None = None
    sla_started_at: datetime | None = None
    ticket_start_at: datetime | None = None
    ticket_end_at: datetime | None = None
    co_owners: list["ServiceRequestCoOwnerResponse"] = []
    stakeholders: list["ServiceRequestStakeholderResponse"] = []
    field_engineers: list["TicketFieldEngineerResponse"] = []
    access: "ServiceRequestTicketAccessInfo | None" = None


class ServiceRequestCoOwnerResponse(OrmModel):
    id: UUID
    request_id: UUID
    employee_id: UUID
    added_by: UUID | None
    added_at: datetime


class ServiceRequestStakeholderResponse(OrmModel):
    id: UUID
    request_id: UUID
    name: str
    email: str
    added_by: UUID | None
    added_at: datetime


class TicketFieldEngineerCreate(BaseModel):
    engineer_name: str = Field(..., min_length=1, max_length=255)
    engineer_contact: str | None = Field(None, max_length=50)
    # Optional contact only — FE portal login removed
    engineer_email: str | None = Field(default=None, max_length=255)
    assigned_date: date | None = None
    work_brief: str | None = None
    show_issue: bool = True
    show_customer: bool = True
    show_site: bool = True
    show_asset: bool = True
    show_circuit: bool = True

    @field_validator("engineer_email", mode="before")
    @classmethod
    def empty_email_to_none(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v


class TicketFieldEngineerUpdate(BaseModel):
    engineer_name: str | None = Field(None, min_length=1, max_length=255)
    engineer_contact: str | None = Field(None, max_length=50)
    engineer_email: str | None = Field(default=None, max_length=255)
    assigned_date: date | None = None
    work_brief: str | None = None
    show_issue: bool | None = None
    show_customer: bool | None = None
    show_site: bool | None = None
    show_asset: bool | None = None
    show_circuit: bool | None = None

    @field_validator("engineer_email", mode="before")
    @classmethod
    def empty_email_to_none(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v


class TicketFieldEngineerSolveAttachment(BaseModel):
    file_name: str
    content_type: str | None = None
    content_base64: str


class TicketFieldEngineerSolve(BaseModel):
    solution_summary: str = Field(..., min_length=1)
    attachments: list[TicketFieldEngineerSolveAttachment] = []


class TicketFieldEngineerResponse(OrmModel):
    id: UUID
    request_id: UUID
    engineer_name: str
    engineer_contact: str | None = None
    engineer_email: str | None = None
    assigned_date: date | None = None
    solution_summary: str | None = None
    status: str
    solved_at: datetime | None = None
    work_brief: str | None = None
    show_issue: bool = True
    show_customer: bool = True
    show_site: bool = True
    show_asset: bool = True
    show_circuit: bool = True
    attachments: list["ServiceRequestAttachmentResponse"] = []
    login_email: str | None = None
    temporary_password: str | None = None
    account_created: bool = False
    credentials_email_sent: bool = False
    credentials_note: str | None = None


class FieldEngineerTicketItem(BaseModel):
    id: UUID
    document_number: str
    subject: str
    status: str
    priority: str
    asset_status: str | None = None
    serial_number: str | None = None
    field_engineer_id: UUID
    field_engineer_status: str
    assigned_date: date | None = None
    solution_summary: str | None = None
    created_at: datetime
    work_brief: str | None = None
    show_issue: bool = True
    show_customer: bool = True
    show_site: bool = True
    show_asset: bool = True
    show_circuit: bool = True
    # Curated sections (null when visibility flag is off)
    issue_description: str | None = None
    end_customer_name: str | None = None
    coordinator_name: str | None = None
    coordinator_phone: str | None = None
    end_customer_street: str | None = None
    end_customer_city: str | None = None
    end_customer_state: str | None = None
    end_customer_postal_code: str | None = None
    site_availability: str | None = None
    site_instructions: str | None = None
    asset_name: str | None = None
    reference_sr_number: str | None = None
    ckt_id: str | None = None
    link_type: str | None = None
    bandwidth: str | None = None
    ports_in_use: str | None = None
    ip_details: str | None = None
    previous_fe_notes: str | None = None


class ServiceRequestCoOwnerCreate(BaseModel):
    employee_id: UUID


class ServiceRequestStakeholderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)


class ServiceRequestResolvePayload(BaseModel):
    solution_type: str = Field(..., min_length=1, max_length=50)
    solution_summary: str = Field(..., min_length=1)
    reason: str | None = None
    # Optionally supplied with resolve; otherwise must already be saved on the ticket
    issue_reported_code: str | None = Field(None, max_length=80)
    resolution_comment_code: str | None = Field(None, max_length=80)
    other_remarks: str | None = None


class ServiceRequestClosePayload(BaseModel):
    reason: str | None = None
    other_remarks: str | None = None
    # Optional: record/update visit charges in the same call (onsite support)
    field_engineer: FieldEngineerVisitPayload | None = None


class ServiceRequestReopenRequestCreate(BaseModel):
    reason: str = Field(..., min_length=1)


class ServiceRequestReopenDecision(BaseModel):
    note: str | None = None


class ServiceRequestReopenRejection(BaseModel):
    rejection_reason: str = Field(..., min_length=1)


class ServiceRequestReopenRequestResponse(OrmModel):
    id: UUID
    request_id: UUID
    reason: str
    requested_by: UUID | None = None
    requested_at: datetime
    status: str
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    rejection_reason: str | None = None
    # Enriched for the approval queue
    document_number: str | None = None
    subject: str | None = None
    requested_by_name: str | None = None


class AssignmentHistoryItem(OrmModel):
    id: UUID
    request_id: UUID
    change_type: str
    old_owner_employee_id: UUID | None = None
    new_owner_employee_id: UUID | None = None
    old_owner_name: str | None = None
    new_owner_name: str | None = None
    reason: str | None = None
    changed_by: UUID | None = None
    changed_at: datetime


class CircuitHistoryItem(BaseModel):
    id: UUID
    document_number: str
    created_at: datetime
    issue_reported_code: str | None = None
    resolution_comment_code: str | None = None
    status: str
    status_label: str
    subject: str


class CircuitHistoryResponse(BaseModel):
    count: int
    last_ticket_at: datetime | None = None
    items: list[CircuitHistoryItem] = []
    ckt_id: str | None = None


class ServiceRequestReopenPayload(BaseModel):
    reason: str | None = None


class ServiceRequestTicketAccessInfo(BaseModel):
    level: str
    is_owner: bool
    is_co_owner: bool
    is_manager: bool
    is_stakeholder: bool
    can_assign: bool
    can_work: bool
    can_manage_collaborators: bool
    can_reopen: bool
    can_open: bool = False
    is_opened: bool = False
    can_resume: bool = False
    can_pause_sla: bool = False
    can_resume_sla: bool = False
    is_on_duty: bool = True
    roster_visibility_enabled: bool = False
    employee_id: UUID | None = None


class ServiceRequestSlaPausePayload(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)


class ServiceRequestSlaResumePayload(BaseModel):
    reason: str | None = Field(None, max_length=2000)


class ServiceRequestSlaPauseItem(BaseModel):
    id: UUID
    request_id: UUID
    paused_at: datetime
    resumed_at: datetime | None = None
    reason: str
    resume_reason: str | None = None
    paused_by: UUID | None = None
    resumed_by: UUID | None = None
    duration_minutes: int | None = None
    is_active: bool = False


class StakeholderFieldEngineerWork(BaseModel):
    engineer_name: str
    engineer_email: str | None = None
    status: str
    solution_summary: str | None = None
    solved_at: datetime | None = None
    work_brief: str | None = None


class ServiceRequestStakeholderView(BaseModel):
    id: UUID
    document_number: str
    subject: str
    status: str
    is_resolved: bool
    is_closed: bool
    resolved_at: datetime | None
    closed_at: datetime | None
    owner_employee_id: UUID | None
    solution_type: str | None = None
    solution_summary: str | None = None
    field_engineer_work: list[StakeholderFieldEngineerWork] = []


class ServiceAssignableEmployee(BaseModel):
    id: UUID
    employee_code: str
    display_name: str
    designation: str | None = None


class ServiceRequestCommentCreate(BaseModel):
    body: str = Field(..., min_length=1)
    is_internal: bool = True


class ServiceRequestCommentResponse(OrmModel):
    id: UUID
    request_id: UUID
    author_user_id: UUID | None
    body: str
    is_internal: bool
    commented_at: datetime


class ServiceRequestAttachmentCreate(BaseModel):
    file_name: str
    content_type: str | None = None
    content_base64: str
    field_engineer_id: UUID | None = None


class ServiceRequestAttachmentResponse(OrmModel):
    id: UUID
    request_id: UUID
    file_name: str
    content_type: str | None
    file_size: int | None
    uploaded_by: UUID | None
    uploaded_at: datetime
    field_engineer_id: UUID | None = None


class ServiceRequestStatusChange(BaseModel):
    status: str = Field(..., min_length=1)
    reason: str | None = None


class ServiceRequestAssignOwner(BaseModel):
    owner_employee_id: UUID
    reason: str | None = None


class ServiceRequestStatusHistoryResponse(OrmModel):
    id: UUID
    from_status: str | None
    to_status: str
    changed_by: UUID | None
    changed_at: datetime
    reason: str | None


class ServiceRequestTimelineItem(BaseModel):
    event_type: str
    title: str
    description: str | None = None
    actor_id: UUID | None = None
    occurred_at: datetime
    from_status: str | None = None
    to_status: str | None = None


class ServiceRequestSlaTrackerItem(BaseModel):
    id: UUID
    document_number: str
    subject: str
    priority: str
    status: str
    sla_status: str | None
    sla_started_at: datetime
    due_at: datetime | None
    owner_employee_id: UUID | None
    owner_name: str | None = None
    elapsed_minutes: int
    remaining_minutes: int | None = None
    is_breached: bool = False
    is_paused: bool = False
    reopened_at: datetime | None = None
    sla_target_minutes: int | None = None
    created_at: datetime | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def status_label(self) -> str:
        return _status_label(self.status, self.reopened_at)


class ServiceRequestResolvedTicketItem(BaseModel):
    id: UUID
    document_number: str
    subject: str
    priority: str
    status: str
    solution_type: str | None
    solution_summary: str | None
    resolved_at: datetime | None
    closed_at: datetime | None
    due_at: datetime | None = None
    closed_within_sla: bool | None = None
    owner_employee_id: UUID | None
    owner_name: str | None = None
    reopened_at: datetime | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def status_label(self) -> str:
        return _status_label(self.status, self.reopened_at)


class ServiceSlaComplianceSummary(BaseModel):
    active_breached: int = 0
    active_paused: int = 0
    closed_within_sla: int = 0
    closed_after_breach: int = 0


class TicketOptionCreate(BaseModel):
    company_id: UUID | None = None
    option_type: str = Field(..., pattern="^(mode|category|issue_reported|resolution_comment)$")
    option_code: str = Field(..., min_length=1, max_length=80)
    option_label: str = Field(..., min_length=1, max_length=255)
    sort_order: int = 0
    status: str = "active"


class TicketOptionUpdate(BaseModel):
    option_label: str | None = None
    sort_order: int | None = None
    status: str | None = None


class TicketOptionResponse(OrmModel):
    id: UUID
    company_id: UUID
    option_type: str
    option_code: str
    option_label: str
    sort_order: int
    status: str
    version: int


class ServiceRequestFollowUpPayload(BaseModel):
    follow_up_at: datetime
    follow_up_note: str | None = None
