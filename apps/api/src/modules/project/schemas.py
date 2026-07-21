"""Project Pydantic schemas."""

from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ProjectUpdate(BaseModel):
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
    version: int

class ProjectPhaseCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProjectPhaseUpdate(BaseModel):
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
    version: int

class ProjectMilestoneCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProjectMilestoneUpdate(BaseModel):
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
    version: int

class ProjectTaskCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ProjectTaskUpdate(BaseModel):
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
    version: int

class TaskDependencyCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class TaskDependencyUpdate(BaseModel):
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
    version: int

class TaskAssignmentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class TaskAssignmentUpdate(BaseModel):
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
    version: int

class TimesheetCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class TimesheetUpdate(BaseModel):
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
    version: int

class TimesheetEntryCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class TimesheetEntryUpdate(BaseModel):
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
    version: int

class ResourcePlanCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ResourcePlanUpdate(BaseModel):
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
    version: int

class ResourceAllocationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ResourceAllocationUpdate(BaseModel):
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
    version: int

class ProjectBudgetCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProjectBudgetUpdate(BaseModel):
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
    version: int

class ProjectCostCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ProjectCostUpdate(BaseModel):
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
    version: int

class ProjectIssueCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProjectIssueUpdate(BaseModel):
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
    version: int

class ProjectRiskCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProjectRiskUpdate(BaseModel):
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
    version: int

class ChangeRequestCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ChangeRequestUpdate(BaseModel):
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
    version: int

class ProjectDocumentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProjectDocumentUpdate(BaseModel):
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
    version: int

class ProjectCommentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProjectCommentUpdate(BaseModel):
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
    version: int

class ProjectStatusHistoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProjectStatusHistoryUpdate(BaseModel):
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
    version: int

class ProjectNotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProjectNotificationUpdate(BaseModel):
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
    version: int

class ProjectReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProjectReportUpdate(BaseModel):
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
    version: int

class ProjectCostPostRequest(BaseModel):
    debit_account_id: UUID
    credit_account_id: UUID
    fiscal_year_id: UUID | None = None
