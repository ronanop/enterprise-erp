"""GRC Pydantic schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PolicyCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PolicyUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PolicyResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    policy_number: str
    policy_code: str
    policy_name: str
    policy_type: str
    owner_employee_id: UUID
    department_id: UUID | None
    current_version_no: int
    effective_from: date | None
    effective_to: date | None
    review_due_at: date | None
    document_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class PolicyVersionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PolicyVersionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PolicyVersionResponse(OrmModel):
    id: UUID
    policy_id: UUID
    version_no: int
    title: str
    summary: str | None
    change_summary: str | None
    document_id: UUID | None
    published_at: datetime | None
    created_by_employee_id: UUID | None
    is_current: bool
    status: str
    company_id: UUID
    version: int

class PolicyAcknowledgementCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PolicyAcknowledgementUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PolicyAcknowledgementResponse(OrmModel):
    id: UUID
    policy_id: UUID
    policy_version_id: UUID | None
    employee_id: UUID
    acknowledged_at: datetime | None
    acknowledgement_method: str | None
    status: str
    company_id: UUID
    version: int

class ControlCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ControlUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ControlResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    control_number: str
    control_code: str
    control_name: str
    control_type: str
    description: str | None
    owner_employee_id: UUID
    department_id: UUID | None
    policy_id: UUID | None
    risk_id: UUID | None
    frequency: str | None
    document_id: UUID | None
    status: str
    company_id: UUID
    version: int

class ControlTestCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ControlTestUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ControlTestResponse(OrmModel):
    id: UUID
    control_id: UUID
    test_number: str
    tested_by_employee_id: UUID
    tested_at: datetime | None
    test_result: str | None
    sample_size: int | None
    findings_summary: str | None
    document_id: UUID | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class RiskCategoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class RiskCategoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RiskCategoryResponse(OrmModel):
    id: UUID
    category_code: str
    category_name: str
    parent_category_id: UUID | None
    description: str | None
    status: str
    company_id: UUID
    version: int

class RiskRegisterCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class RiskRegisterUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RiskRegisterResponse(OrmModel):
    id: UUID
    risk_number: str
    risk_title: str
    risk_category_id: UUID
    owner_employee_id: UUID
    department_id: UUID | None
    description: str | None
    inherent_impact: int | None
    inherent_probability: int | None
    inherent_score: int | None
    residual_impact: int | None
    residual_probability: int | None
    residual_score: int | None
    risk_level: str | None
    project_id: UUID | None
    asset_id: UUID | None
    crm_opportunity_id: UUID | None
    inventory_ref_id: UUID | None
    production_order_id: UUID | None
    document_id: UUID | None
    next_review_at: date | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class RiskAssessmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class RiskAssessmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RiskAssessmentResponse(OrmModel):
    id: UUID
    risk_id: UUID
    assessment_number: str
    assessed_by_employee_id: UUID
    assessed_at: datetime | None
    impact: int | None
    probability: int | None
    risk_score: int | None
    risk_level: str | None
    assessment_notes: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class RiskTreatmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class RiskTreatmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RiskTreatmentResponse(OrmModel):
    id: UUID
    risk_id: UUID
    treatment_number: str
    treatment_strategy: str
    action_plan: str | None
    owner_employee_id: UUID
    target_date: date | None
    control_id: UUID | None
    completed_at: datetime | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class ComplianceFrameworkCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ComplianceFrameworkUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ComplianceFrameworkResponse(OrmModel):
    id: UUID
    framework_code: str
    framework_name: str
    framework_type: str
    jurisdiction: str | None
    description: str | None
    owner_employee_id: UUID | None
    document_id: UUID | None
    status: str
    company_id: UUID
    version: int

class ComplianceRequirementCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ComplianceRequirementUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ComplianceRequirementResponse(OrmModel):
    id: UUID
    framework_id: UUID
    requirement_code: str
    requirement_name: str
    description: str | None
    compliance_area: str | None
    owner_employee_id: UUID | None
    due_date: date | None
    status: str
    company_id: UUID
    version: int

class ComplianceAssessmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ComplianceAssessmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ComplianceAssessmentResponse(OrmModel):
    id: UUID
    requirement_id: UUID
    assessment_number: str
    assessed_by_employee_id: UUID
    assessed_at: datetime | None
    compliance_status: str | None
    evidence_summary: str | None
    document_id: UUID | None
    next_due_at: date | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class AuditPlanCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AuditPlanUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AuditPlanResponse(OrmModel):
    id: UUID
    plan_code: str
    plan_name: str
    plan_year: int | None
    owner_employee_id: UUID
    scope_summary: str | None
    period_start: date | None
    period_end: date | None
    status: str
    company_id: UUID
    version: int

class AuditCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AuditUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AuditResponse(OrmModel):
    id: UUID
    audit_number: str
    audit_plan_id: UUID | None
    audit_type: str
    title: str
    lead_auditor_employee_id: UUID
    department_id: UUID | None
    planned_start: date | None
    planned_end: date | None
    actual_start: date | None
    actual_end: date | None
    document_id: UUID | None
    project_id: UUID | None
    quality_nonconformance_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class AuditFindingCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AuditFindingUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AuditFindingResponse(OrmModel):
    id: UUID
    audit_id: UUID
    finding_number: str
    severity: str
    title: str
    description: str | None
    action_required: str | None
    owner_employee_id: UUID | None
    due_date: date | None
    control_id: UUID | None
    risk_id: UUID | None
    document_id: UUID | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class CorrectiveActionCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class CorrectiveActionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class CorrectiveActionResponse(OrmModel):
    id: UUID
    capa_number: str
    finding_id: UUID | None
    incident_id: UUID | None
    title: str
    description: str | None
    owner_employee_id: UUID
    due_date: date | None
    completed_at: datetime | None
    effectiveness_result: str | None
    document_id: UUID | None
    quality_nonconformance_id: UUID | None
    helpdesk_ticket_id: UUID | None
    finance_journal_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class ExceptionCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ExceptionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ExceptionResponse(OrmModel):
    id: UUID
    exception_number: str
    exception_type: str
    title: str
    description: str | None
    requested_by_employee_id: UUID
    approver_employee_id: UUID | None
    policy_id: UUID | None
    control_id: UUID | None
    risk_id: UUID | None
    valid_from: date | None
    valid_to: date | None
    document_id: UUID | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class IncidentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class IncidentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class IncidentResponse(OrmModel):
    id: UUID
    incident_number: str
    incident_type: str
    title: str
    description: str | None
    reported_by_employee_id: UUID
    owner_employee_id: UUID | None
    customer_id: UUID | None
    department_id: UUID | None
    risk_id: UUID | None
    control_id: UUID | None
    severity: str | None
    occurred_at: datetime | None
    detected_at: datetime | None
    helpdesk_ticket_id: UUID | None
    service_request_id: UUID | None
    project_id: UUID | None
    quality_nonconformance_id: UUID | None
    asset_id: UUID | None
    document_id: UUID | None
    finance_journal_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class NotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class NotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class NotificationResponse(OrmModel):
    id: UUID
    document_id: UUID | None
    notification_type: str
    recipient_user_id: UUID | None
    recipient_employee_id: UUID | None
    payload_json: dict | None
    sent_at: datetime | None
    delivery_status: str
    status: str
    company_id: UUID
    version: int

class ReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReportResponse(OrmModel):
    id: UUID
    report_code: str
    report_type: str
    period_start: date | None
    period_end: date | None
    department_id: UUID | None
    folder_id: UUID | None
    metrics_json: dict | None
    generated_at: datetime | None
    status: str
    company_id: UUID
    version: int
