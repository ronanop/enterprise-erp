"""Project Pydantic schemas."""

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SiteInstallationNestedCreate(BaseModel):
    """Optional payload nested under ProjectCreate.site_installation."""

    delivery_type: str = Field(default="server_os_rack", max_length=40)
    requestor_name: str | None = Field(default=None, max_length=255)
    circle: str | None = Field(default=None, max_length=100)
    cloud_name: str | None = Field(default=None, max_length=255)
    site_name: str | None = Field(default=None, max_length=255)
    power_requirements: str | None = None
    rfai_request_done: bool = False
    rfai_number: str | None = Field(default=None, max_length=100)
    fabric_partner: str | None = Field(default=None, max_length=255)
    application: str | None = Field(default=None, max_length=255)
    remarks: str | None = None


class ProjectCreate(BaseModel):
    """Create is Intake-first: customer + site + power + RFAI.

    Legacy project fields (name, PM, dates, …) are optional and filled by
    ProjectService when omitted.
    """

    company_id: UUID | None = None
    branch_id: UUID
    customer_id: UUID | None = None
    project_name: str | None = Field(default=None, max_length=255)
    project_type: str | None = Field(default=None, max_length=40)
    department_id: UUID | None = None
    project_manager_employee_id: UUID | None = None
    sponsor_employee_id: UUID | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    actual_start_date: date | None = None
    actual_end_date: date | None = None
    budget_amount: Decimal | None = None
    currency_code: str | None = Field(default=None, max_length=10)
    billing_type: str | None = None
    crm_opportunity_id: UUID | None = None
    crm_customer_id: UUID | None = None
    health_status: str | None = None
    description: str | None = None
    status: str | None = None
    site_installation: SiteInstallationNestedCreate | None = None

class ProjectUpdate(BaseModel):
    project_name: str | None = Field(default=None, min_length=1, max_length=255)
    project_type: str | None = None
    customer_id: UUID | None = None
    department_id: UUID | None = None
    project_manager_employee_id: UUID | None = None
    sponsor_employee_id: UUID | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    actual_start_date: date | None = None
    actual_end_date: date | None = None
    budget_amount: Decimal | None = None
    currency_code: str | None = None
    billing_type: str | None = None
    health_status: str | None = None
    description: str | None = None
    status: str | None = None
    version: int | None = None

class ProjectResponse(OrmModel):
    id: UUID
    project_code: str
    project_name: str
    project_type: str
    customer_id: UUID | None
    department_id: UUID | None
    project_manager_employee_id: UUID
    sponsor_employee_id: UUID | None
    planned_start_date: date
    planned_end_date: date
    actual_start_date: date | None
    actual_end_date: date | None
    budget_amount: Decimal | None
    currency_code: str
    billing_type: str | None
    crm_opportunity_id: UUID | None
    crm_customer_id: UUID | None
    health_status: str | None
    description: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectPhaseCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID
    phase_code: str | None = Field(default=None, max_length=50)
    phase_name: str = Field(min_length=1, max_length=255)
    sequence_no: int = Field(default=1, ge=1)
    planned_start_date: date
    planned_end_date: date
    status: str | None = None

class ProjectPhaseUpdate(BaseModel):
    phase_name: str | None = Field(default=None, min_length=1, max_length=255)
    sequence_no: int | None = Field(default=None, ge=1)
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    status: str | None = None
    version: int | None = None

class ProjectPhaseResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    project_id: UUID
    phase_code: str
    phase_name: str
    sequence_no: int
    planned_start_date: date
    planned_end_date: date
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectMilestoneCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID
    phase_id: UUID | None = None
    milestone_code: str | None = Field(default=None, max_length=50)
    milestone_name: str = Field(min_length=1, max_length=255)
    owner_employee_id: UUID | None = None
    due_date: date
    status: str | None = None

class ProjectMilestoneUpdate(BaseModel):
    phase_id: UUID | None = None
    milestone_name: str | None = Field(default=None, min_length=1, max_length=255)
    owner_employee_id: UUID | None = None
    due_date: date | None = None
    achieved_at: datetime | None = None
    status: str | None = None
    version: int | None = None

class ProjectMilestoneResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    project_id: UUID
    phase_id: UUID | None
    milestone_code: str
    milestone_name: str
    owner_employee_id: UUID | None
    due_date: date
    achieved_at: datetime | None
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectTaskCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    project_id: UUID
    phase_id: UUID | None = None
    milestone_id: UUID | None = None
    parent_task_id: UUID | None = None
    task_name: str = Field(min_length=1, max_length=255)
    priority: str = Field(default="medium", max_length=20)
    planned_start_date: date | None = None
    due_date: date | None = None
    estimated_hours: Decimal | None = None
    actual_hours: Decimal | None = None
    percent_complete: Decimal | None = Field(default=None, ge=0, le=100)
    status: str | None = None

class ProjectTaskUpdate(BaseModel):
    phase_id: UUID | None = None
    milestone_id: UUID | None = None
    parent_task_id: UUID | None = None
    task_name: str | None = Field(default=None, min_length=1, max_length=255)
    priority: str | None = None
    planned_start_date: date | None = None
    due_date: date | None = None
    estimated_hours: Decimal | None = None
    actual_hours: Decimal | None = None
    percent_complete: Decimal | None = Field(default=None, ge=0, le=100)
    status: str | None = None
    version: int | None = None

class ProjectTaskResponse(OrmModel):
    id: UUID
    document_number: str | None
    project_id: UUID
    phase_id: UUID | None
    milestone_id: UUID | None
    parent_task_id: UUID | None
    task_name: str
    priority: str
    planned_start_date: date | None
    due_date: date | None
    estimated_hours: Decimal | None
    actual_hours: Decimal | None
    percent_complete: Decimal | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    created_at: datetime | None = None
    version: int

class TaskDependencyCreate(BaseModel):
    company_id: UUID | None = None
    project_id: UUID
    from_task_id: UUID
    to_task_id: UUID
    dependency_type: str = Field(default="finish_to_start", max_length=30)
    lag_days: int = Field(default=0, ge=0)
    status: str | None = None

class TaskDependencyUpdate(BaseModel):
    dependency_type: str | None = None
    lag_days: int | None = Field(default=None, ge=0)
    status: str | None = None
    version: int | None = None

class TaskDependencyResponse(OrmModel):
    id: UUID
    project_id: UUID
    from_task_id: UUID
    to_task_id: UUID
    dependency_type: str
    lag_days: int
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class TaskAssignmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    task_id: UUID
    project_id: UUID
    employee_id: UUID
    role_on_task: str = Field(default="contributor", max_length=30)
    allocation_percent: Decimal | None = Field(default=None, ge=0, le=100)
    assigned_at: datetime | None = None
    status: str | None = None

class TaskAssignmentUpdate(BaseModel):
    role_on_task: str | None = None
    allocation_percent: Decimal | None = Field(default=None, ge=0, le=100)
    status: str | None = None
    version: int | None = None

class TaskAssignmentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    task_id: UUID
    project_id: UUID
    employee_id: UUID
    role_on_task: str
    allocation_percent: Decimal | None
    assigned_at: datetime | None
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class TimesheetCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    project_id: UUID | None = None
    period_start: date
    period_end: date
    total_hours: Decimal | None = Field(default=None, ge=0)
    status: str | None = None

class TimesheetUpdate(BaseModel):
    employee_id: UUID | None = None
    project_id: UUID | None = None
    period_start: date | None = None
    period_end: date | None = None
    total_hours: Decimal | None = Field(default=None, ge=0)
    status: str | None = None
    version: int | None = None

class TimesheetResponse(OrmModel):
    id: UUID
    document_number: str
    employee_id: UUID
    project_id: UUID | None
    period_start: date
    period_end: date
    total_hours: Decimal | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    created_at: datetime | None = None
    version: int

class TimesheetEntryCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    timesheet_id: UUID
    project_id: UUID
    task_id: UUID
    employee_id: UUID
    work_date: date
    hours_worked: Decimal = Field(gt=0, le=24)
    description: str | None = None
    status: str | None = None

class TimesheetEntryUpdate(BaseModel):
    task_id: UUID | None = None
    work_date: date | None = None
    hours_worked: Decimal | None = Field(default=None, gt=0, le=24)
    description: str | None = None
    status: str | None = None
    version: int | None = None

class TimesheetEntryResponse(OrmModel):
    id: UUID
    timesheet_id: UUID
    project_id: UUID
    task_id: UUID
    employee_id: UUID
    work_date: date
    hours_worked: Decimal
    description: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    created_at: datetime | None = None
    version: int

class ResourcePlanCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID
    plan_name: str = Field(min_length=1, max_length=255)
    planned_from: date
    planned_to: date
    status: str | None = None

class ResourcePlanUpdate(BaseModel):
    plan_name: str | None = Field(default=None, min_length=1, max_length=255)
    planned_from: date | None = None
    planned_to: date | None = None
    status: str | None = None
    version: int | None = None

class ResourcePlanResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    document_number: str
    project_id: UUID
    plan_name: str
    planned_from: date
    planned_to: date
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ResourceAllocationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    resource_plan_id: UUID
    project_id: UUID
    employee_id: UUID
    resource_type: str = Field(default="employee", max_length=30)
    allocation_percent: Decimal = Field(ge=0, le=100)
    start_date: date
    end_date: date
    status: str | None = None

class ResourceAllocationUpdate(BaseModel):
    resource_type: str | None = None
    allocation_percent: Decimal | None = Field(default=None, ge=0, le=100)
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None
    version: int | None = None

class ResourceAllocationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    resource_plan_id: UUID
    project_id: UUID
    employee_id: UUID
    resource_type: str
    allocation_percent: Decimal
    start_date: date
    end_date: date
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectBudgetCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID
    budget_type: str = Field(max_length=30)
    budget_amount: Decimal = Field(ge=0)
    currency_code: str = Field(default="INR", max_length=10)
    fiscal_year_id: UUID | None = None
    cost_center_code: str | None = Field(default=None, max_length=50)
    status: str | None = None

class ProjectBudgetUpdate(BaseModel):
    budget_type: str | None = None
    budget_amount: Decimal | None = Field(default=None, ge=0)
    currency_code: str | None = None
    fiscal_year_id: UUID | None = None
    cost_center_code: str | None = None
    status: str | None = None
    version: int | None = None

class ProjectBudgetResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    document_number: str
    project_id: UUID
    budget_type: str
    budget_amount: Decimal
    currency_code: str
    fiscal_year_id: UUID | None
    cost_center_code: str | None
    finance_budget_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectCostCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    project_id: UUID
    cost_source: str = Field(max_length=30)
    cost_amount: Decimal = Field(ge=0)
    currency_code: str = Field(default="INR", max_length=10)
    cost_date: date
    employee_id: UUID | None = None
    product_id: UUID | None = None
    timesheet_entry_id: UUID | None = None
    idempotency_key: str | None = Field(default=None, max_length=100)
    status: str | None = None

class ProjectCostUpdate(BaseModel):
    cost_source: str | None = None
    cost_amount: Decimal | None = Field(default=None, ge=0)
    currency_code: str | None = None
    cost_date: date | None = None
    employee_id: UUID | None = None
    product_id: UUID | None = None
    status: str | None = None
    version: int | None = None

class ProjectCostResponse(OrmModel):
    id: UUID
    document_number: str
    project_id: UUID
    cost_source: str
    cost_amount: Decimal
    currency_code: str
    cost_date: date
    employee_id: UUID | None
    product_id: UUID | None
    timesheet_entry_id: UUID | None
    purchase_request_id: UUID | None
    purchase_order_id: UUID | None
    material_issue_id: UUID | None
    material_receipt_id: UUID | None
    production_order_id: UUID | None
    quality_inspection_id: UUID | None
    finance_journal_id: UUID | None
    idempotency_key: str
    status: str
    company_id: UUID
    branch_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectIssueCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID
    task_id: UUID | None = None
    issue_title: str = Field(min_length=1, max_length=255)
    severity: str = Field(default="medium", max_length=20)
    owner_employee_id: UUID | None = None
    opened_at: datetime | None = None
    status: str | None = None

class ProjectIssueUpdate(BaseModel):
    task_id: UUID | None = None
    issue_title: str | None = Field(default=None, min_length=1, max_length=255)
    severity: str | None = None
    owner_employee_id: UUID | None = None
    resolved_at: datetime | None = None
    status: str | None = None
    version: int | None = None

class ProjectIssueResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    document_number: str
    project_id: UUID
    task_id: UUID | None
    issue_title: str
    severity: str
    owner_employee_id: UUID | None
    opened_at: datetime | None
    resolved_at: datetime | None
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectRiskCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID
    risk_name: str = Field(min_length=1, max_length=255)
    impact: str = Field(default="medium", max_length=20)
    probability: str = Field(default="medium", max_length=20)
    risk_level: str = Field(default="medium", max_length=20)
    owner_employee_id: UUID | None = None
    mitigation_plan: str | None = None
    review_date: date | None = None
    status: str | None = None

class ProjectRiskUpdate(BaseModel):
    risk_name: str | None = Field(default=None, min_length=1, max_length=255)
    impact: str | None = None
    probability: str | None = None
    risk_level: str | None = None
    owner_employee_id: UUID | None = None
    mitigation_plan: str | None = None
    review_date: date | None = None
    status: str | None = None
    version: int | None = None

class ProjectRiskResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    document_number: str
    project_id: UUID
    risk_name: str
    impact: str
    probability: str
    risk_level: str
    owner_employee_id: UUID | None
    mitigation_plan: str | None
    review_date: date | None
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ChangeRequestCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    project_id: UUID
    change_title: str = Field(min_length=1, max_length=255)
    change_type: str = Field(max_length=30)
    requested_by_employee_id: UUID
    impact_summary: str | None = None
    budget_impact_amount: Decimal | None = None
    schedule_impact_days: int | None = None
    status: str | None = None

class ChangeRequestUpdate(BaseModel):
    change_title: str | None = Field(default=None, min_length=1, max_length=255)
    change_type: str | None = None
    requested_by_employee_id: UUID | None = None
    impact_summary: str | None = None
    budget_impact_amount: Decimal | None = None
    schedule_impact_days: int | None = None
    status: str | None = None
    version: int | None = None

class ChangeRequestResponse(OrmModel):
    id: UUID
    document_number: str
    project_id: UUID
    change_title: str
    change_type: str
    requested_by_employee_id: UUID
    impact_summary: str | None
    budget_impact_amount: Decimal | None
    schedule_impact_days: int | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectDocumentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID
    task_id: UUID | None = None
    milestone_id: UUID | None = None
    document_type: str = Field(default="other", max_length=30)
    document_name: str = Field(min_length=1, max_length=255)
    storage_uri: str | None = Field(default=None, max_length=500)
    content_hash: str | None = Field(default=None, max_length=128)
    uploaded_by_employee_id: UUID | None = None
    status: str | None = None

class ProjectDocumentUpdate(BaseModel):
    document_type: str | None = None
    document_name: str | None = Field(default=None, min_length=1, max_length=255)
    storage_uri: str | None = None
    status: str | None = None
    version: int | None = None

class ProjectDocumentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    project_id: UUID
    task_id: UUID | None
    milestone_id: UUID | None
    document_type: str
    document_name: str
    storage_uri: str | None
    content_hash: str | None
    uploaded_by_employee_id: UUID | None
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectCommentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID
    task_id: UUID | None = None
    issue_id: UUID | None = None
    risk_id: UUID | None = None
    author_user_id: UUID
    comment_text: str = Field(min_length=1)
    status: str | None = None

class ProjectCommentUpdate(BaseModel):
    comment_text: str | None = Field(default=None, min_length=1)
    status: str | None = None
    version: int | None = None

class ProjectCommentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    project_id: UUID
    task_id: UUID | None
    issue_id: UUID | None
    risk_id: UUID | None
    author_user_id: UUID
    comment_text: str
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectStatusHistoryCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID
    from_status: str = Field(max_length=30)
    to_status: str = Field(max_length=30)
    changed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    changed_by_user_id: UUID
    reason: str | None = None
    status: str | None = None

class ProjectStatusHistoryUpdate(BaseModel):
    reason: str | None = None
    status: str | None = None
    version: int | None = None

class ProjectStatusHistoryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    project_id: UUID
    from_status: str
    to_status: str
    changed_at: datetime
    changed_by_user_id: UUID
    reason: str | None
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectNotificationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID
    notification_type: str = Field(max_length=50)
    recipient_user_id: UUID | None = None
    recipient_employee_id: UUID | None = None
    payload_json: dict | None = None
    status: str | None = None

class ProjectNotificationUpdate(BaseModel):
    delivery_status: str | None = None
    sent_at: datetime | None = None
    status: str | None = None
    version: int | None = None

class ProjectNotificationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    project_id: UUID
    notification_type: str
    recipient_user_id: UUID | None
    recipient_employee_id: UUID | None
    payload_json: dict | None
    sent_at: datetime | None
    delivery_status: str
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectReportCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    project_id: UUID | None = None
    report_type: str = Field(max_length=50)
    period_start: date
    period_end: date
    metrics_json: dict | None = None
    status: str | None = None

class ProjectReportUpdate(BaseModel):
    metrics_json: dict | None = None
    status: str | None = None
    version: int | None = None

class ProjectReportResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    report_code: str
    project_id: UUID | None
    report_type: str
    period_start: date
    period_end: date
    metrics_json: dict | None
    generated_at: datetime | None
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int

class ProjectCostPostRequest(BaseModel):
    debit_account_id: UUID
    credit_account_id: UUID
    fiscal_year_id: UUID | None = None


# ---------------------------------------------------------------------------
# Site Installation workflow
# ---------------------------------------------------------------------------


_Date = date


class MaterialLine(BaseModel):
    type: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=1)
    date: _Date | None = None


class SiteInstallationCreate(BaseModel):
    project_id: UUID
    delivery_type: str = Field(default="server_os_rack", max_length=40)
    requestor_name: str | None = Field(default=None, max_length=255)
    circle: str | None = Field(default=None, max_length=100)
    cloud_name: str | None = Field(default=None, max_length=255)
    site_name: str | None = Field(default=None, max_length=255)
    power_requirements: str | None = None
    rfai_request_done: bool | None = None
    rfai_number: str | None = Field(default=None, max_length=100)
    fabric_partner: str | None = Field(default=None, max_length=255)
    application: str | None = Field(default=None, max_length=255)
    cable_length: str | None = Field(default=None, max_length=100)
    industrial_socket: bool | None = None
    lugs: bool | None = None
    cable_lines: list[MaterialLine] | None = None
    lug_lines: list[MaterialLine] | None = None
    industrial_socket_lines: list[MaterialLine] | None = None
    power_on_material: bool | None = None
    power_on_material_date: date | None = None
    tile_details: str | None = None
    survey_completed: bool | None = None
    survey_completed_date: date | None = None
    space_available: bool | None = None
    space_available_date: date | None = None
    power_available: bool | None = None
    power_available_date: date | None = None
    server_qty: int | None = Field(default=None, ge=0)
    rack_qty: int | None = Field(default=None, ge=0)
    server_wh_delivery_date: date | None = None
    server_on_site_delivery_date: date | None = None
    rack_wh_delivery_date: date | None = None
    rack_on_site_delivery_date: date | None = None
    pdu_wh_delivery_date: date | None = None
    pdu_on_site_delivery_date: date | None = None
    mo_request: bool | None = None
    mo_request_date: date | None = None
    im_material: bool | None = None
    im_material_date: date | None = None
    material_handover_done: bool | None = None
    material_handover_date: date | None = None
    rack_server_stacking_done: bool | None = None
    rack_server_stacking_date: date | None = None
    rack_server_power_on_done: bool | None = None
    rack_server_power_on_date: date | None = None
    dac_ilo_cabling_done: bool | None = None
    dac_ilo_cabling_date: date | None = None
    bios_configuration_done: bool | None = None
    bios_configuration_date: date | None = None
    firmware_nw_config_done: bool | None = None
    firmware_nw_config_date: date | None = None
    lld_done: bool | None = None
    lld_date: date | None = None
    os_installation_done: bool | None = None
    os_installation_date: date | None = None
    mbss_done: bool | None = None
    mbss_date: date | None = None
    vascan_done: bool | None = None
    vascan_date: date | None = None
    handover_to_cloud_done: bool | None = None
    handover_to_cloud_date: date | None = None
    hwat_request_done: bool | None = None
    hwat_request_date: date | None = None
    hwat_signoff_received: bool | None = None
    hwat_signoff_date: date | None = None
    survey_assignee_employee_id: UUID | None = None
    scm_assignee_employee_id: UUID | None = None
    installation_assignee_employee_id: UUID | None = None
    configuration_assignee_employee_id: UUID | None = None
    acceptance_assignee_employee_id: UUID | None = None
    survey_assigned_date: date | None = None
    survey_finished_date: date | None = None
    scm_assigned_date: date | None = None
    scm_finished_date: date | None = None
    installation_assigned_date: date | None = None
    installation_finished_date: date | None = None
    acceptance_assigned_date: date | None = None
    acceptance_finished_date: date | None = None
    remarks: str | None = None


class SiteInstallationUpdate(BaseModel):
    delivery_type: str | None = Field(default=None, max_length=40)
    requestor_name: str | None = Field(default=None, max_length=255)
    circle: str | None = Field(default=None, max_length=100)
    cloud_name: str | None = Field(default=None, max_length=255)
    site_name: str | None = Field(default=None, max_length=255)
    power_requirements: str | None = None
    rfai_request_done: bool | None = None
    rfai_number: str | None = Field(default=None, max_length=100)
    fabric_partner: str | None = Field(default=None, max_length=255)
    application: str | None = Field(default=None, max_length=255)
    cable_length: str | None = Field(default=None, max_length=100)
    industrial_socket: bool | None = None
    lugs: bool | None = None
    cable_lines: list[MaterialLine] | None = None
    lug_lines: list[MaterialLine] | None = None
    industrial_socket_lines: list[MaterialLine] | None = None
    power_on_material: bool | None = None
    power_on_material_date: date | None = None
    tile_details: str | None = None
    survey_completed: bool | None = None
    survey_completed_date: date | None = None
    space_available: bool | None = None
    space_available_date: date | None = None
    power_available: bool | None = None
    power_available_date: date | None = None
    server_qty: int | None = Field(default=None, ge=0)
    rack_qty: int | None = Field(default=None, ge=0)
    server_wh_delivery_date: date | None = None
    server_on_site_delivery_date: date | None = None
    rack_wh_delivery_date: date | None = None
    rack_on_site_delivery_date: date | None = None
    pdu_wh_delivery_date: date | None = None
    pdu_on_site_delivery_date: date | None = None
    mo_request: bool | None = None
    mo_request_date: date | None = None
    im_material: bool | None = None
    im_material_date: date | None = None
    material_handover_done: bool | None = None
    material_handover_date: date | None = None
    rack_server_stacking_done: bool | None = None
    rack_server_stacking_date: date | None = None
    rack_server_power_on_done: bool | None = None
    rack_server_power_on_date: date | None = None
    dac_ilo_cabling_done: bool | None = None
    dac_ilo_cabling_date: date | None = None
    bios_configuration_done: bool | None = None
    bios_configuration_date: date | None = None
    firmware_nw_config_done: bool | None = None
    firmware_nw_config_date: date | None = None
    lld_done: bool | None = None
    lld_date: date | None = None
    os_installation_done: bool | None = None
    os_installation_date: date | None = None
    mbss_done: bool | None = None
    mbss_date: date | None = None
    vascan_done: bool | None = None
    vascan_date: date | None = None
    handover_to_cloud_done: bool | None = None
    handover_to_cloud_date: date | None = None
    hwat_request_done: bool | None = None
    hwat_request_date: date | None = None
    hwat_signoff_received: bool | None = None
    hwat_signoff_date: date | None = None
    survey_assignee_employee_id: UUID | None = None
    scm_assignee_employee_id: UUID | None = None
    installation_assignee_employee_id: UUID | None = None
    configuration_assignee_employee_id: UUID | None = None
    acceptance_assignee_employee_id: UUID | None = None
    survey_assigned_date: date | None = None
    survey_finished_date: date | None = None
    scm_assigned_date: date | None = None
    scm_finished_date: date | None = None
    installation_assigned_date: date | None = None
    installation_finished_date: date | None = None
    acceptance_assigned_date: date | None = None
    acceptance_finished_date: date | None = None
    remarks: str | None = None
    version: int | None = None


class SiteInstallationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    project_id: UUID
    document_number: str
    delivery_type: str
    workflow_stage: str
    requestor_name: str | None
    circle: str | None
    cloud_name: str | None
    site_name: str | None
    power_requirements: str | None
    rfai_request_done: bool
    rfai_number: str | None
    fabric_partner: str | None
    application: str | None
    cable_length: str | None
    industrial_socket: bool
    lugs: bool
    cable_lines: list[MaterialLine] = Field(default_factory=list)
    lug_lines: list[MaterialLine] = Field(default_factory=list)
    industrial_socket_lines: list[MaterialLine] = Field(default_factory=list)
    power_on_material: bool
    power_on_material_date: date | None = None
    tile_details: str | None
    survey_completed: bool
    survey_completed_date: date | None = None
    space_available: bool
    space_available_date: date | None = None
    power_available: bool
    power_available_date: date | None = None
    server_qty: int | None
    rack_qty: int | None
    server_wh_delivery_date: date | None
    server_on_site_delivery_date: date | None
    rack_wh_delivery_date: date | None
    rack_on_site_delivery_date: date | None
    pdu_wh_delivery_date: date | None
    pdu_on_site_delivery_date: date | None
    mo_request: bool
    mo_request_date: date | None = None
    im_material: bool
    im_material_date: date | None = None
    material_handover_done: bool
    material_handover_date: date | None = None
    rack_server_stacking_done: bool
    rack_server_stacking_date: date | None = None
    rack_server_power_on_done: bool
    rack_server_power_on_date: date | None = None
    dac_ilo_cabling_done: bool
    dac_ilo_cabling_date: date | None = None
    bios_configuration_done: bool
    bios_configuration_date: date | None = None
    firmware_nw_config_done: bool
    firmware_nw_config_date: date | None = None
    lld_done: bool
    lld_date: date | None = None
    os_installation_done: bool
    os_installation_date: date | None = None
    mbss_done: bool
    mbss_date: date | None = None
    vascan_done: bool
    vascan_date: date | None = None
    handover_to_cloud_done: bool
    handover_to_cloud_date: date | None = None
    hwat_request_done: bool
    hwat_request_date: date | None = None
    hwat_signoff_received: bool
    hwat_signoff_date: date | None = None
    survey_assignee_employee_id: UUID | None = None
    scm_assignee_employee_id: UUID | None = None
    installation_assignee_employee_id: UUID | None = None
    configuration_assignee_employee_id: UUID | None = None
    acceptance_assignee_employee_id: UUID | None = None
    survey_assigned_date: date | None = None
    survey_finished_date: date | None = None
    scm_assigned_date: date | None = None
    scm_finished_date: date | None = None
    installation_assigned_date: date | None = None
    installation_finished_date: date | None = None
    acceptance_assigned_date: date | None = None
    acceptance_finished_date: date | None = None
    remarks: str | None
    status: str
    company_id: UUID
    created_at: datetime | None = None
    version: int


class SiteStageAssignmentBlueprint(BaseModel):
    stage: str
    label: str
    assignee_employee_id: UUID | None = None
    work_status: str
    assigned_date: date | None = None
    completed_date: date | None = None


class SiteInstallationBlueprintResponse(BaseModel):
    entity: str
    state: str
    delivery_type: str
    allowed_actions: list[str]
    action_labels: dict[str, str]
    stages: list[dict[str, str]]
    stage_assignments: list[SiteStageAssignmentBlueprint] = Field(default_factory=list)
    terminal: bool
    includes_os: bool | None = None
    includes_bios: bool | None = None
    includes_server: bool | None = None
    is_rack_only: bool | None = None
    needs_hwat: bool | None = None


class SiteInstallationAdvanceRequest(BaseModel):
    action: str = Field(min_length=1, max_length=80)


class SiteInstallationFollowUpRequest(BaseModel):
    stage: str = Field(min_length=1, max_length=40)
    note: str | None = Field(default=None, max_length=1000)


class SiteInstallationFollowUpResponse(BaseModel):
    stage: str
    stage_label: str
    recipient_employee_id: UUID
    notification_id: UUID
    message: str


class SiteStageFollowUpReplyItem(BaseModel):
    id: UUID
    body: str
    created_at: datetime
    employee_id: UUID


class SiteInstallationFollowUpReplyRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class SiteStageFollowUpItem(BaseModel):
    id: UUID
    stage: str
    stage_label: str
    recipient_employee_id: UUID | None = None
    message: str
    note: str | None = None
    site_name: str | None = None
    document_number: str | None = None
    delivery_status: str | None = None
    status: str | None = None
    created_at: datetime | None = None
    sent_at: datetime | None = None
    replies: list[SiteStageFollowUpReplyItem] = Field(default_factory=list)
    has_reply: bool = False
    latest_reply: str | None = None
    latest_reply_at: datetime | None = None


class ProjectPortfolioFollowUpItem(SiteStageFollowUpItem):
    project_id: UUID
    project_name: str


class ProjectMyJobItem(BaseModel):
    """Delivery step assigned to the signed-in user (one row per stage ownership)."""

    site_installation_id: UUID
    project_id: UUID
    project_name: str
    document_number: str
    site_name: str | None = None
    assigned_stage: str
    workflow_stage: str
    stage_label: str
    delivery_type: str
    form_path: str
