"""HR Pydantic schemas."""

from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DesignationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    designation_code: str
    designation_name: str
    job_level: str | None = None
    status: str = "active"


class DesignationUpdate(BaseModel):
    designation_name: str | None = None
    job_level: str | None = None
    status: str | None = None
    version: int | None = None


class DesignationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    designation_code: str
    designation_name: str
    job_level: str | None
    status: str
    company_id: UUID
    version: int


class EmployeeProfileCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    date_of_birth: date | None = None
    gender: str | None = None
    marital_status: str | None = None
    nationality: str | None = None
    blood_group: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_mobile: str | None = None
    permanent_address_json: dict | None = None
    current_address_json: dict | None = None
    status: str = "active"


class EmployeeProfileUpdate(BaseModel):
    date_of_birth: date | None = None
    gender: str | None = None
    marital_status: str | None = None
    nationality: str | None = None
    blood_group: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_mobile: str | None = None
    permanent_address_json: dict | None = None
    current_address_json: dict | None = None
    status: str | None = None
    version: int | None = None


class EmployeeProfileResponse(OrmModel):
    id: UUID
    employee_id: UUID
    employee_code: str | None = None
    employee_name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    designation: str | None = None
    date_of_birth: date | None
    gender: str | None
    marital_status: str | None
    nationality: str | None
    blood_group: str | None
    emergency_contact_name: str | None
    emergency_contact_mobile: str | None
    permanent_address_json: dict | None
    current_address_json: dict | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int


class EmploymentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    employment_type: str
    date_of_joining: date
    probation_end_date: date | None = None
    confirmation_date: date | None = None
    contract_end_date: date | None = None
    notice_period_days: int | None = None
    ctc_amount: Decimal | None = None
    currency_code: str | None = None
    work_location_text: str | None = None
    status: str = "draft"


class EmploymentUpdate(BaseModel):
    employment_type: str | None = None
    probation_end_date: date | None = None
    confirmation_date: date | None = None
    contract_end_date: date | None = None
    notice_period_days: int | None = None
    ctc_amount: Decimal | None = None
    currency_code: str | None = None
    work_location_text: str | None = None
    status: str | None = None
    version: int | None = None


class EmploymentResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    employee_id: UUID
    employment_type: str
    date_of_joining: date
    status: str
    version: int


class DepartmentAssignmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    department_id: UUID
    effective_from: date
    effective_to: date | None = None
    is_primary: bool = True
    assigned_by_employee_id: UUID | None = None
    status: str = "active"


class DepartmentAssignmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    department_id: UUID
    effective_from: date
    effective_to: date | None
    is_primary: bool
    status: str
    version: int


class DesignationAssignmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    designation_id: UUID
    effective_from: date
    effective_to: date | None = None
    is_primary: bool = True
    sync_master_label: bool = True
    status: str = "active"


class DesignationAssignmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    designation_id: UUID
    effective_from: date
    effective_to: date | None
    is_primary: bool
    status: str
    version: int


class ShiftCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    shift_code: str
    shift_name: str
    shift_type: str
    start_time: time
    end_time: time
    grace_minutes: int = 0
    break_minutes: int | None = None
    is_overnight: bool = False
    status: str = "active"


class ShiftUpdate(BaseModel):
    shift_name: str | None = None
    shift_type: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    grace_minutes: int | None = None
    break_minutes: int | None = None
    is_overnight: bool | None = None
    status: str | None = None
    version: int | None = None


class ShiftResponse(OrmModel):
    id: UUID
    company_id: UUID
    shift_code: str
    shift_name: str
    shift_type: str
    start_time: time
    end_time: time
    status: str
    version: int


class ShiftAssignmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    shift_id: UUID
    effective_from: date
    effective_to: date | None = None


class ShiftAssignmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    employee_id: UUID
    shift_id: UUID
    effective_from: date
    status: str
    version: int


class HolidayCalendarCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    calendar_code: str
    calendar_name: str
    calendar_year: int
    holidays_json: list | dict | None = None
    status: str = "draft"


class HolidayCalendarUpdate(BaseModel):
    calendar_name: str | None = None
    holidays_json: list | dict | None = None
    status: str | None = None
    version: int | None = None


class HolidayCalendarResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    calendar_code: str
    calendar_name: str
    calendar_year: int
    holidays_json: dict | list | None
    status: str
    company_id: UUID
    version: int


class LeaveTypeCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    leave_type_code: str
    leave_type_name: str
    is_paid: bool = True
    max_days_per_year: Decimal | None = None
    requires_attachment: bool = False
    status: str = "active"


class LeaveTypeUpdate(BaseModel):
    leave_type_name: str | None = None
    is_paid: bool | None = None
    max_days_per_year: Decimal | None = None
    requires_attachment: bool | None = None
    status: str | None = None
    version: int | None = None


class LeaveTypeResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    leave_type_code: str
    leave_type_name: str
    is_paid: bool
    max_days_per_year: Decimal | None
    requires_attachment: bool
    status: str
    company_id: UUID
    version: int


class LeaveBalanceCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    leave_type_id: UUID
    balance_year: int
    opening_balance: Decimal = Decimal("0")
    accrued: Decimal = Decimal("0")
    used: Decimal = Decimal("0")
    status: str = "open"


class LeaveBalanceResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    leave_type_id: UUID
    balance_year: int
    opening_balance: Decimal
    accrued: Decimal
    used: Decimal
    closing_balance: Decimal
    status: str
    version: int


class LeaveRequestCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    leave_type_id: UUID
    start_date: date
    end_date: date
    days_count: Decimal
    reason: str | None = None


class LeaveApproveRequest(BaseModel):
    approver_employee_id: UUID | None = None


class LeaveRequestResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    employee_id: UUID
    leave_type_id: UUID
    start_date: date
    end_date: date
    days_count: Decimal
    status: str
    version: int


class AttendanceCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    attendance_date: date
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    total_hours: Decimal | None = None
    attendance_status: str
    source: str = "manual"
    shift_id: UUID | None = None
    notes: str | None = None


class AttendanceUpdate(BaseModel):
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    total_hours: Decimal | None = None
    attendance_status: str | None = None
    notes: str | None = None
    version: int | None = None


class AttendanceResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    attendance_date: date
    attendance_status: str
    source: str
    status: str
    version: int


class EmployeeDocumentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    document_type: str
    document_name: str
    storage_uri: str
    issued_on: date | None = None
    expires_on: date | None = None


class EmployeeDocumentResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    employee_id: UUID
    document_type: str
    document_name: str
    storage_uri: str
    verification_status: str
    status: str
    version: int


class PerformanceReviewCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    reviewer_employee_id: UUID
    review_cycle: str
    period_start: date
    period_end: date
    overall_rating: int | None = None


class PerformanceReviewResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    employee_id: UUID
    reviewer_employee_id: UUID
    review_cycle: str
    period_start: date
    period_end: date
    status: str
    version: int


class GoalCreate(BaseModel):
    company_id: UUID | None = None
    performance_review_id: UUID
    employee_id: UUID | None = None
    sequence_no: int
    goal_title: str
    goal_description: str | None = None
    target_value: Decimal | None = None
    actual_value: Decimal | None = None
    weight_percent: Decimal | None = None


class GoalResponse(OrmModel):
    id: UUID
    performance_review_id: UUID
    employee_id: UUID
    sequence_no: int
    goal_title: str
    goal_description: str | None
    target_value: Decimal | None
    actual_value: Decimal | None
    weight_percent: Decimal | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int


class AppraisalCreate(BaseModel):
    company_id: UUID | None = None
    performance_review_id: UUID
    employee_id: UUID | None = None
    sequence_no: int
    appraisal_area: str
    rating: int
    comments: str | None = None


class AppraisalResponse(OrmModel):
    id: UUID
    performance_review_id: UUID
    employee_id: UUID
    sequence_no: int
    appraisal_area: str
    rating: int
    comments: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int


class TrainingCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    training_code: str | None = None
    training_name: str
    training_type: str
    trainer_name: str | None = None
    trainer_employee_id: UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str = "planned"


class TrainingUpdate(BaseModel):
    training_name: str | None = None
    training_type: str | None = None
    trainer_name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None
    version: int | None = None


class TrainingResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    training_code: str
    training_name: str
    training_type: str
    trainer_name: str | None
    trainer_employee_id: UUID | None
    start_date: date | None
    end_date: date | None
    status: str
    company_id: UUID
    version: int


class TrainingAssignRequest(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID


class TrainingAttendanceResponse(OrmModel):
    id: UUID
    training_id: UUID
    employee_id: UUID
    attendance_status: str
    completion_percent: Decimal | None
    certificate_uri: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int


class SeparationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    separation_type: str
    requested_last_working_date: date
    reason: str | None = None
    clearance_json: dict | None = None


class SeparationApproveRequest(BaseModel):
    stage: str = "manager"


class SeparationCompleteRequest(BaseModel):
    approved_last_working_date: date | None = None


class SeparationResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    employee_id: UUID
    separation_type: str
    requested_last_working_date: date
    approved_last_working_date: date | None
    status: str
    version: int


class ReportSummaryResponse(BaseModel):
    company_id: UUID
    attendance_count: int
    leave_request_count: int
    approved_leave_count: int
    separation_count: int
    completed_separation_count: int
