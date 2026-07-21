"""Recruitment Pydantic schemas."""

from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class JobRequisitionCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class JobRequisitionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class JobRequisitionResponse(OrmModel):
    id: UUID
    document_number: str
    requisition_title: str
    department_id: UUID
    designation_id: UUID | None
    employment_type: str
    openings_count: int
    filled_count: int
    hiring_manager_employee_id: UUID
    recruiter_id: UUID | None
    priority: str
    target_hire_date: date | None
    min_experience_years: Decimal | None
    max_experience_years: Decimal | None
    salary_band_min: Decimal | None
    salary_band_max: Decimal | None
    currency_code: str | None
    job_description: str | None
    justification: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class JobPostingCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class JobPostingUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class JobPostingResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    document_number: str
    job_requisition_id: UUID
    posting_title: str
    channel: str
    recruitment_source_id: UUID | None
    publish_from: date | None
    publish_to: datetime | None
    external_url: str | None
    crm_campaign_id: UUID | None
    status: str
    company_id: UUID
    version: int

class RecruitmentSourceCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class RecruitmentSourceUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RecruitmentSourceResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    source_code: str
    source_name: str
    source_type: str
    is_active: bool
    status: str
    company_id: UUID
    version: int

class RecruiterCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class RecruiterUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RecruiterResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    recruiter_code: str
    employee_id: UUID
    display_name: str
    max_open_requisitions: int | None
    status: str
    company_id: UUID
    version: int

class CandidateCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class CandidateUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class CandidateResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    candidate_code: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    mobile: str | None
    current_title: str | None
    current_employer: str | None
    total_experience_years: Decimal | None
    highest_education: str | None
    recruitment_source_id: UUID | None
    primary_recruiter_id: UUID | None
    employee_id: UUID | None
    status: str
    company_id: UUID
    version: int

class CandidateDocumentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class CandidateDocumentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class CandidateDocumentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    candidate_id: UUID
    document_type: str
    document_name: str
    storage_uri: str
    content_hash: str | None
    mime_type: str | None
    file_size_bytes: int | None
    verified_flag: bool
    status: str
    company_id: UUID
    version: int

class ResumeCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ResumeUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ResumeResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    candidate_id: UUID
    version_no: int
    storage_uri: str
    content_hash: str | None
    parsed_skills_json: dict | None
    is_primary: bool
    status: str
    company_id: UUID
    version: int

class ApplicationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ApplicationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ApplicationResponse(OrmModel):
    id: UUID
    document_number: str
    candidate_id: UUID
    job_requisition_id: UUID
    job_posting_id: UUID | None
    recruitment_source_id: UUID | None
    recruiter_id: UUID | None
    applied_at: datetime
    current_stage_code: str | None
    rejection_reason: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class ApplicationStageCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ApplicationStageUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ApplicationStageResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    application_id: UUID
    stage_code: str
    stage_name: str
    sequence_no: int
    entered_at: datetime
    exited_at: datetime | None
    changed_by_user_id: UUID
    notes: str | None
    status: str
    company_id: UUID
    version: int

class InterviewCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class InterviewUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class InterviewResponse(OrmModel):
    id: UUID
    document_number: str
    application_id: UUID
    candidate_id: UUID
    interview_type: str
    scheduled_at: datetime
    duration_minutes: int
    location: str | None
    meeting_url: str | None
    interviewer_employee_id: UUID
    panel_json: dict | None
    result: str
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class InterviewFeedbackCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class InterviewFeedbackUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class InterviewFeedbackResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    interview_id: UUID
    interviewer_employee_id: UUID
    overall_score: Decimal | None
    recommendation: str | None
    competency_scores_json: dict | None
    comments: str | None
    submitted_at: datetime | None
    status: str
    company_id: UUID
    version: int

class OfferCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class OfferUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class OfferResponse(OrmModel):
    id: UUID
    document_number: str
    application_id: UUID
    candidate_id: UUID
    job_requisition_id: UUID
    department_id: UUID
    designation_id: UUID | None
    offered_ctc: Decimal | None
    offered_gross: Decimal | None
    currency_code: str
    joining_date: date
    offer_valid_until: date | None
    employment_type: str
    salary_structure_id: UUID | None
    offer_letter_uri: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class OfferApprovalCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class OfferApprovalUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class OfferApprovalResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    offer_id: UUID
    approver_employee_id: UUID
    approval_level: int
    decision: str
    decided_at: datetime | None
    comments: str | None
    status: str
    company_id: UUID
    version: int

class BackgroundVerificationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class BackgroundVerificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class BackgroundVerificationResponse(OrmModel):
    id: UUID
    document_number: str
    candidate_id: UUID
    offer_id: UUID | None
    application_id: UUID | None
    vendor_name: str | None
    verification_scope_json: dict | None
    initiated_at: datetime | None
    completed_at: datetime | None
    result: str
    report_uri: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class ReferenceCheckCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReferenceCheckUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReferenceCheckResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    candidate_id: UUID
    application_id: UUID | None
    reference_name: str
    reference_org: str | None
    reference_email: str | None
    reference_phone: str | None
    relationship: str
    feedback_summary: str | None
    rating: Decimal | None
    checked_at: datetime | None
    checked_by_employee_id: UUID | None
    status: str
    company_id: UUID
    version: int

class TalentPoolCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class TalentPoolUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class TalentPoolResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    pool_code: str
    pool_name: str
    candidate_id: UUID
    skill_tags_json: dict | None
    availability: str
    added_at: datetime
    status: str
    company_id: UUID
    version: int

class CandidateNoteCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class CandidateNoteUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class CandidateNoteResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    candidate_id: UUID
    application_id: UUID | None
    author_user_id: UUID
    note_type: str
    note_text: str
    is_private: bool
    status: str
    company_id: UUID
    version: int

class OnboardingCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class OnboardingUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class OnboardingResponse(OrmModel):
    id: UUID
    document_number: str
    offer_id: UUID
    candidate_id: UUID
    application_id: UUID
    job_requisition_id: UUID
    department_id: UUID
    designation_id: UUID | None
    planned_joining_date: date | None
    actual_joining_date: date | None
    employee_id: UUID | None
    hr_employment_request_id: UUID | None
    payroll_handoff_status: str
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class OnboardingTaskCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class OnboardingTaskUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class OnboardingTaskResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    onboarding_id: UUID
    task_code: str
    task_name: str
    sequence_no: int
    is_mandatory: bool
    due_date: date | None
    completed_at: datetime | None
    assignee_employee_id: UUID | None
    completion_notes: str | None
    status: str
    company_id: UUID
    version: int

class RecruitmentReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class RecruitmentReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RecruitmentReportResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    report_code: str
    report_type: str
    period_start: date
    period_end: date
    department_id: UUID | None
    job_requisition_id: UUID | None
    metrics_json: dict | None
    generated_at: datetime
    status: str
    company_id: UUID
    version: int

class OnboardingCompleteRequest(BaseModel):
    designation: str
