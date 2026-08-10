"""Pydantic schemas for Service Request Ticket Management (SOP)."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Nested section payloads ---

class FieldEngineerVisitPayload(BaseModel):
    engineer_name: str | None = None
    engineer_contact: str | None = None
    distance: str | None = None
    visits_count: int | None = None
    carrying_spares: bool = False
    visit_date: date | None = None
    hw_replacement: str | None = None
    transport_mode: str | None = None
    movement_charges: Decimal | None = None
    visit_charges: Decimal | None = None
    total_charges: Decimal | None = None
    remarks: str | None = None
    payment_approval: str | None = None


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

    mode_of_action: str = Field(..., min_length=1)
    service_type: str = Field(..., min_length=1)
    subject: str = Field(..., min_length=1)
    contact_name: str = Field(..., min_length=1)
    status: str = "ticket_registered"
    priority: str = Field(..., min_length=1)
    channel: str = Field(..., min_length=1)
    ticket_category: str = Field(..., min_length=1)
    sla_status: str = Field(..., min_length=1)

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
    field_engineer: FieldEngineerVisitPayload | None = None
    oem_support: OemSupportPayload | None = None
    solution_summary: str | None = None
    solution_type: str | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    reopened_at: datetime | None = None
    ownership_locked: bool = False
    opened_at: datetime | None = None
    opened_by: UUID | None = None
    sla_started_at: datetime | None = None
    co_owners: list["ServiceRequestCoOwnerResponse"] = []
    stakeholders: list["ServiceRequestStakeholderResponse"] = []
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


class ServiceRequestCoOwnerCreate(BaseModel):
    employee_id: UUID


class ServiceRequestStakeholderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)


class ServiceRequestResolvePayload(BaseModel):
    solution_type: str = Field(..., min_length=1, max_length=50)
    solution_summary: str = Field(..., min_length=1)
    reason: str | None = None


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
    employee_id: UUID | None = None


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


class ServiceRequestAttachmentResponse(OrmModel):
    id: UUID
    request_id: UUID
    file_name: str
    content_type: str | None
    file_size: int | None
    uploaded_by: UUID | None
    uploaded_at: datetime


class ServiceRequestStatusChange(BaseModel):
    status: str = Field(..., min_length=1)
    reason: str | None = None


class ServiceRequestAssignOwner(BaseModel):
    owner_employee_id: UUID


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
    owner_employee_id: UUID | None
    owner_name: str | None = None
