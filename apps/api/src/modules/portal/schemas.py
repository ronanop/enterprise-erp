"""Customer Portal Pydantic schemas."""

from decimal import Decimal
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PortalAccountCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PortalAccountUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PortalAccountResponse(OrmModel):
    id: UUID
    account_number: str
    login_email: str
    customer_id: UUID
    customer_profile_id: UUID | None
    display_name: str
    credential_vault_ref: str | None
    status: str
    owner_employee_id: UUID | None
    department_id: UUID | None
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class CustomerProfileCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class CustomerProfileUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class CustomerProfileResponse(OrmModel):
    id: UUID
    profile_number: str
    customer_id: UUID
    display_name: str
    preferred_language: str | None
    timezone: str | None
    billing_contact_json: dict | None
    shipping_contact_json: dict | None
    crm_party_ref_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class PortalSessionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PortalSessionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PortalSessionResponse(OrmModel):
    id: UUID
    session_number: str
    portal_account_id: UUID
    device_id: UUID | None
    started_at: datetime | None
    expires_at: datetime | None
    ended_at: datetime | None
    ip_address: str | None
    user_agent: str | None
    status: str
    company_id: UUID
    version: int

class DashboardCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DashboardUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DashboardResponse(OrmModel):
    id: UUID
    dashboard_number: str
    portal_account_id: UUID
    dashboard_code: str
    dashboard_name: str
    layout_json: dict | list | None
    is_default: bool
    status: str
    company_id: UUID
    version: int

class DashboardWidgetCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DashboardWidgetUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DashboardWidgetResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    dashboard_id: UUID
    widget_code: str
    widget_title: str
    widget_type: str
    metric_id: UUID | None
    kpi_id: UUID | None
    report_id: UUID | None
    dataset_id: UUID | None
    config_json: dict | None
    sequence_no: int
    status: str
    company_id: UUID
    version: int

class NotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class NotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class NotificationResponse(OrmModel):
    id: UUID
    portal_account_id: UUID
    notification_type: str
    title: str
    body: str | None
    related_entity_type: str | None
    related_entity_id: UUID | None
    read_at: datetime | None
    delivery_status: str
    status: str
    company_id: UUID
    version: int

class MessageThreadCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MessageThreadUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MessageThreadResponse(OrmModel):
    id: UUID
    thread_number: str
    portal_account_id: UUID
    subject: str
    related_entity_type: str
    related_entity_id: UUID | None
    status: str
    company_id: UUID
    version: int

class MessageCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MessageUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MessageResponse(OrmModel):
    id: UUID
    message_number: str
    message_thread_id: UUID
    sender_account_id: UUID | None
    sender_employee_id: UUID | None
    body: str
    sent_at: datetime | None
    status: str
    company_id: UUID
    version: int

class OrderViewCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class OrderViewUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class OrderViewResponse(OrmModel):
    id: UUID
    view_number: str
    portal_account_id: UUID
    customer_id: UUID
    sales_order_id: UUID | None
    ec_order_id: UUID | None
    order_ref: str | None
    order_status_text: str | None
    product_id: UUID | None
    ordered_at: datetime | None
    last_synced_at: datetime | None
    status: str
    company_id: UUID
    version: int

class InvoiceViewCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class InvoiceViewUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class InvoiceViewResponse(OrmModel):
    id: UUID
    view_number: str
    portal_account_id: UUID
    customer_id: UUID
    finance_invoice_id: UUID | None
    sales_invoice_id: UUID | None
    invoice_ref: str | None
    amount_due: Decimal | None
    currency: str | None
    due_at: datetime | None
    finance_journal_id: UUID | None
    last_synced_at: datetime | None
    status: str
    company_id: UUID
    version: int

class DocumentAccessCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentAccessUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentAccessResponse(OrmModel):
    id: UUID
    access_number: str
    portal_account_id: UUID
    document_id: UUID | None
    access_level: str
    granted_by_employee_id: UUID
    granted_at: datetime | None
    expires_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class SupportTicketCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SupportTicketUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SupportTicketResponse(OrmModel):
    id: UUID
    ticket_number: str
    portal_account_id: UUID
    customer_id: UUID
    subject: str
    description: str | None
    priority: str
    helpdesk_ticket_id: UUID | None
    assigned_employee_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class ServiceRequestCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceRequestUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceRequestResponse(OrmModel):
    id: UUID
    request_number: str
    portal_account_id: UUID
    customer_id: UUID
    request_type: str
    description: str | None
    service_request_id: UUID | None
    preferred_slot_json: dict | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class DownloadHistoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DownloadHistoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DownloadHistoryResponse(OrmModel):
    id: UUID
    download_number: str
    portal_account_id: UUID
    document_access_id: UUID
    document_id: UUID | None
    downloaded_at: datetime | None
    bytes_transferred: int | None
    status: str
    company_id: UUID
    version: int

class SavedReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SavedReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SavedReportResponse(OrmModel):
    id: UUID
    saved_report_number: str
    portal_account_id: UUID
    report_name: str
    source_type: str
    bi_report_ref_id: UUID | None
    definition_json: dict | None
    status: str
    company_id: UUID
    version: int

class SavedSearchCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SavedSearchUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SavedSearchResponse(OrmModel):
    id: UUID
    saved_search_number: str
    portal_account_id: UUID
    search_name: str
    entity_type: str
    query_json: dict | None
    status: str
    company_id: UUID
    version: int

class PreferenceCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PreferenceUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PreferenceResponse(OrmModel):
    id: UUID
    portal_account_id: UUID
    preference_key: str
    preference_value_json: dict | None
    status: str
    company_id: UUID
    version: int

class DeviceCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DeviceUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DeviceResponse(OrmModel):
    id: UUID
    device_number: str
    portal_account_id: UUID
    device_fingerprint: str
    device_name: str | None
    platform: str | None
    last_seen_at: datetime | None
    is_trusted: bool
    status: str
    company_id: UUID
    version: int

class LoginAuditCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class LoginAuditUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class LoginAuditResponse(OrmModel):
    id: UUID
    audit_number: str
    portal_account_id: UUID | None
    device_id: UUID | None
    event_type: str
    occurred_at: datetime | None
    ip_address: str | None
    user_agent: str | None
    status: str
    company_id: UUID
    version: int

class PortalReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PortalReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PortalReportResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int
