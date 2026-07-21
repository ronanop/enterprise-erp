"""Helpdesk Pydantic schemas."""

from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TicketCategoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketCategoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketCategoryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    category_code: str
    category_name: str
    parent_category_id: UUID | None
    default_priority_id: UUID | None
    default_sla_id: UUID | None
    status: str
    company_id: UUID
    version: int


class TicketPriorityCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketPriorityUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketPriorityResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    priority_code: str
    priority_name: str
    rank_order: int
    default_response_minutes: int | None
    default_resolution_minutes: int | None
    status: str
    company_id: UUID
    version: int


class TicketCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None


class TicketUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketResponse(OrmModel):
    id: UUID
    document_number: str
    category_id: UUID
    priority_id: UUID
    ticket_type: str
    customer_id: UUID | None
    requester_employee_id: UUID | None
    department_id: UUID | None
    support_team_id: UUID | None
    sla_id: UUID | None
    subject: str
    description: str | None
    channel: str | None
    impact: str | None
    urgency: str | None
    sla_status: str | None
    is_shared_queue: bool
    service_request_id: UUID | None
    service_ticket_id: UUID | None
    work_order_id: UUID | None
    crm_opportunity_id: UUID | None
    crm_customer_id: UUID | None
    project_id: UUID | None
    asset_id: UUID | None
    inventory_issue_id: UUID | None
    quality_case_id: UUID | None
    production_order_id: UUID | None
    opened_at: datetime | None
    due_at: datetime | None
    resolved_at: datetime | None
    closed_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int


class TicketAssignmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None


class TicketAssignmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketAssignmentResponse(OrmModel):
    id: UUID
    document_number: str
    ticket_id: UUID
    assignee_employee_id: UUID
    support_team_id: UUID | None
    role_on_ticket: str
    assigned_at: datetime | None
    unassigned_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int


class TicketStatusHistoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketStatusHistoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketStatusHistoryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    ticket_id: UUID
    from_status: str | None
    to_status: str
    changed_by_employee_id: UUID | None
    changed_at: datetime
    reason: str | None
    status: str
    company_id: UUID
    version: int


class TicketCommentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketCommentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketCommentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    ticket_id: UUID
    author_employee_id: UUID | None
    author_customer_id: UUID | None
    is_public: bool
    body: str
    commented_at: datetime
    status: str
    company_id: UUID
    version: int


class TicketAttachmentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketAttachmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketAttachmentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    ticket_id: UUID
    comment_id: UUID | None
    file_name: str
    content_type: str | None
    storage_uri: str | None
    content_hash: str | None
    uploaded_by_employee_id: UUID | None
    status: str
    company_id: UUID
    version: int


class TicketActivityCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketActivityUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketActivityResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    ticket_id: UUID
    activity_type: str
    actor_employee_id: UUID | None
    payload_json: dict | None
    occurred_at: datetime
    status: str
    company_id: UUID
    version: int


class TicketSlaCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketSlaUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketSlaResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    sla_code: str
    sla_name: str
    priority_id: UUID | None
    response_minutes: int
    resolution_minutes: int
    business_hours_only: bool
    status: str
    company_id: UUID
    version: int


class TicketEscalationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None


class TicketEscalationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketEscalationResponse(OrmModel):
    id: UUID
    document_number: str
    ticket_id: UUID
    sla_id: UUID | None
    escalation_level: int
    reason_code: str
    escalated_to_employee_id: UUID
    escalated_at: datetime
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int


class KnowledgeBaseCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class KnowledgeBaseUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class KnowledgeBaseResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    kb_code: str
    kb_name: str
    description: str | None
    owner_employee_id: UUID | None
    is_public: bool
    status: str
    company_id: UUID
    version: int


class KnowledgeArticleCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class KnowledgeArticleUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class KnowledgeArticleResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    document_number: str
    knowledge_base_id: UUID
    article_code: str
    title: str
    body: str | None
    category_id: UUID | None
    author_employee_id: UUID
    published_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int


class ResolutionCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None


class ResolutionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class ResolutionResponse(OrmModel):
    id: UUID
    document_number: str
    ticket_id: UUID
    resolution_code: str
    resolution_summary: str | None
    knowledge_article_id: UUID | None
    resolved_by_employee_id: UUID
    resolved_at: datetime | None
    first_time_fix: bool
    finance_journal_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int


class CustomerFeedbackCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class CustomerFeedbackUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class CustomerFeedbackResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    ticket_id: UUID
    customer_id: UUID
    rating: int
    comments: str | None
    captured_at: datetime
    channel: str | None
    status: str
    company_id: UUID
    version: int


class SupportTeamCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class SupportTeamUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class SupportTeamResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    team_code: str
    team_name: str
    department_id: UUID | None
    lead_employee_id: UUID | None
    status: str
    company_id: UUID
    version: int


class SupportShiftCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class SupportShiftUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class SupportShiftResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    support_team_id: UUID
    shift_code: str
    shift_name: str
    start_time: time
    end_time: time
    timezone: str
    status: str
    company_id: UUID
    version: int


class SupportScheduleCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None


class SupportScheduleUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class SupportScheduleResponse(OrmModel):
    id: UUID
    document_number: str
    support_team_id: UUID
    support_shift_id: UUID
    employee_id: UUID
    schedule_date: date
    planned_start: datetime
    planned_end: datetime
    status: str
    company_id: UUID
    branch_id: UUID
    version: int


class TicketNotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketNotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketNotificationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    ticket_id: UUID | None
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


class TicketReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketReportResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    report_code: str
    report_type: str
    period_start: date
    period_end: date
    category_id: UUID | None
    team_id: UUID | None
    department_id: UUID | None
    metrics_json: dict | None
    generated_at: datetime | None
    status: str
    company_id: UUID
    version: int


class TicketDashboardCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketDashboardUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketDashboardResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    dashboard_code: str
    dashboard_name: str
    owner_employee_id: UUID | None
    layout_json: dict | None
    metrics_json: dict | None
    refreshed_at: datetime | None
    status: str
    company_id: UUID
    version: int
