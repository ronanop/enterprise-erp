"""Service Pydantic schemas."""

from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ServiceCategoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceCategoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceCategoryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    category_code: str
    category_name: str
    default_priority: str
    default_sla_id: UUID | None
    is_billable_default: bool
    status: str
    company_id: UUID
    version: int

class ServiceRequestCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ServiceRequestUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceRequestResponse(OrmModel):
    id: UUID
    document_number: str
    category_id: UUID
    customer_id: UUID
    requested_by_employee_id: UUID | None
    department_id: UUID | None
    contract_id: UUID | None
    service_type: str
    priority: str
    channel: str | None
    subject: str
    description: str | None
    master_asset_id: UUID | None
    asset_id: UUID | None
    maintenance_plan_id: UUID | None
    crm_opportunity_id: UUID | None
    crm_customer_id: UUID | None
    project_id: UUID | None
    requested_at: datetime | None
    due_at: datetime | None
    sla_id: UUID | None
    sla_status: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class ServiceTicketCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ServiceTicketUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceTicketResponse(OrmModel):
    id: UUID
    document_number: str
    request_id: UUID
    ticket_type: str
    queue_code: str | None
    priority: str
    owner_employee_id: UUID | None
    opened_at: datetime | None
    closed_at: datetime | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class ServiceAssignmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ServiceAssignmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceAssignmentResponse(OrmModel):
    id: UUID
    document_number: str
    request_id: UUID | None
    ticket_id: UUID | None
    work_order_id: UUID | None
    technician_employee_id: UUID
    role_on_job: str
    assigned_at: datetime | None
    unassigned_at: datetime | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class ServiceScheduleCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ServiceScheduleUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceScheduleResponse(OrmModel):
    id: UUID
    document_number: str
    work_order_id: UUID
    technician_employee_id: UUID
    planned_start: datetime
    planned_end: datetime
    actual_start: datetime | None
    actual_end: datetime | None
    timezone: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class WorkOrderCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class WorkOrderUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class WorkOrderResponse(OrmModel):
    id: UUID
    document_number: str
    request_id: UUID
    ticket_id: UUID | None
    work_order_type: str
    primary_technician_id: UUID | None
    scheduled_date: date | None
    completed_date: date | None
    asset_id: UUID | None
    maintenance_plan_id: UUID | None
    inventory_issue_id: UUID | None
    inventory_receipt_id: UUID | None
    purchase_order_id: UUID | None
    project_id: UUID | None
    production_order_id: UUID | None
    quality_inspection_id: UUID | None
    estimated_hours: Decimal | None
    actual_hours: Decimal | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class ServiceTaskCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceTaskUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceTaskResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    work_order_id: UUID
    task_code: str
    task_name: str
    sequence_no: int
    assignee_employee_id: UUID | None
    planned_hours: Decimal | None
    actual_hours: Decimal | None
    status: str
    company_id: UUID
    version: int

class ServiceChecklistCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceChecklistUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceChecklistResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    work_order_id: UUID | None
    visit_id: UUID | None
    task_id: UUID | None
    checklist_code: str
    checklist_name: str
    items_json: dict | None
    completed_at: datetime | None
    completed_by_employee_id: UUID | None
    status: str
    company_id: UUID
    version: int

class ServiceVisitCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ServiceVisitUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceVisitResponse(OrmModel):
    id: UUID
    document_number: str
    work_order_id: UUID
    technician_employee_id: UUID
    visit_started_at: datetime | None
    visit_ended_at: datetime | None
    site_address: str | None
    geo_lat: Decimal | None
    geo_lng: Decimal | None
    customer_signoff_name: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class ServiceMaterialCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceMaterialUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceMaterialResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    work_order_id: UUID
    product_id: UUID
    quantity: Decimal
    unit_cost: Decimal | None
    line_amount: Decimal | None
    inventory_issue_id: UUID | None
    status: str
    company_id: UUID
    version: int

class ServiceTimeEntryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceTimeEntryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceTimeEntryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    work_order_id: UUID
    task_id: UUID | None
    visit_id: UUID | None
    employee_id: UUID
    entry_date: date
    hours: Decimal
    is_billable: bool
    labor_rate: Decimal | None
    amount: Decimal | None
    status: str
    company_id: UUID
    version: int

class ServiceExpenseCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ServiceExpenseUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceExpenseResponse(OrmModel):
    id: UUID
    document_number: str
    work_order_id: UUID | None
    request_id: UUID | None
    expense_type: str
    amount: Decimal
    currency_code: str
    incurred_on: date
    employee_id: UUID | None
    is_billable: bool
    finance_journal_id: UUID | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class ServiceSlaCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceSlaUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceSlaResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    sla_code: str
    sla_name: str
    contract_id: UUID | None
    priority: str
    response_minutes: int
    resolution_minutes: int
    business_hours_only: bool
    status: str
    company_id: UUID
    version: int

class ServiceEscalationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ServiceEscalationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceEscalationResponse(OrmModel):
    id: UUID
    document_number: str
    request_id: UUID | None
    ticket_id: UUID | None
    work_order_id: UUID | None
    sla_id: UUID | None
    escalation_level: int
    reason_code: str
    escalated_to_employee_id: UUID
    escalated_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class ServiceFeedbackCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceFeedbackUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceFeedbackResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    request_id: UUID
    work_order_id: UUID | None
    customer_id: UUID
    rating: int
    comments: str | None
    captured_at: datetime | None
    channel: str | None
    status: str
    company_id: UUID
    version: int

class ServiceResolutionCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ServiceResolutionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceResolutionResponse(OrmModel):
    id: UUID
    document_number: str
    request_id: UUID
    work_order_id: UUID | None
    ticket_id: UUID | None
    resolution_code: str
    resolution_summary: str | None
    resolved_by_employee_id: UUID
    resolved_at: datetime | None
    first_time_fix: bool
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class ServiceDocumentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceDocumentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceDocumentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    request_id: UUID | None
    work_order_id: UUID | None
    contract_id: UUID | None
    visit_id: UUID | None
    document_type: str
    document_name: str
    storage_uri: str | None
    content_hash: str | None
    status: str
    company_id: UUID
    version: int

class ServiceNotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceNotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceNotificationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    request_id: UUID | None
    work_order_id: UUID | None
    contract_id: UUID | None
    notification_type: str
    recipient_user_id: UUID | None
    recipient_employee_id: UUID | None
    recipient_customer_id: UUID | None
    payload_json: dict | None
    sent_at: datetime | None
    delivery_status: str
    status: str
    company_id: UUID
    version: int

class ServiceContractCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ServiceContractUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceContractResponse(OrmModel):
    id: UUID
    document_number: str
    customer_id: UUID
    contract_type: str
    start_date: date
    end_date: date
    coverage_notes: str | None
    default_sla_id: UUID | None
    department_id: UUID | None
    crm_opportunity_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class ServiceReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceReportResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    report_code: str
    report_type: str
    period_start: date
    period_end: date
    customer_id: UUID | None
    department_id: UUID | None
    category_id: UUID | None
    metrics_json: dict | None
    generated_at: datetime | None
    status: str
    company_id: UUID
    version: int

class FinancePostRequest(BaseModel):
    debit_account_id: UUID
    credit_account_id: UUID
    fiscal_year_id: UUID | None = None
