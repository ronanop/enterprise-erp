"""HR Pydantic schemas."""

from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    """ORM-backed response base — includes standard audit columns everywhere."""

    model_config = ConfigDict(from_attributes=True)

    created_at: datetime | None = None
    created_by: UUID | None = None
    updated_at: datetime | None = None
    updated_by: UUID | None = None


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


class JobLevelCreate(BaseModel):
    company_id: UUID | None = None
    level_code: str
    level_name: str
    rank_order: int = 0
    status: str = "active"


class JobLevelUpdate(BaseModel):
    level_name: str | None = None
    rank_order: int | None = None
    status: str | None = None
    version: int | None = None


class JobLevelResponse(OrmModel):
    id: UUID
    level_code: str
    level_name: str
    rank_order: int
    status: str
    company_id: UUID
    version: int


class GradeCreate(BaseModel):
    company_id: UUID | None = None
    grade_code: str
    grade_name: str
    min_ctc: Decimal | None = None
    max_ctc: Decimal | None = None
    status: str = "active"


class GradeUpdate(BaseModel):
    grade_name: str | None = None
    min_ctc: Decimal | None = None
    max_ctc: Decimal | None = None
    status: str | None = None
    version: int | None = None


class GradeResponse(OrmModel):
    id: UUID
    grade_code: str
    grade_name: str
    min_ctc: Decimal | None = None
    max_ctc: Decimal | None = None
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
    aadhaar_number: str | None = None
    pan_number: str | None = None
    uan_number: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    bank_account_holder: str | None = None
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
    aadhaar_number: str | None = None
    pan_number: str | None = None
    uan_number: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    bank_account_holder: str | None = None
    education_json: dict | list | None = None
    skills_json: dict | list | None = None
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
    aadhaar_number: str | None = None
    pan_number: str | None = None
    uan_number: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    bank_account_holder: str | None = None
    education_json: dict | list | None = None
    skills_json: dict | list | None = None
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
    probation_start_date: date | None = None
    probation_end_date: date | None = None
    confirmation_date: date | None = None
    contract_end_date: date | None = None
    notice_period_days: int | None = None
    ctc_amount: Decimal | None = None
    currency_code: str | None = None
    work_location_text: str | None = None
    lifecycle_source: str | None = None
    payroll_eligible: bool = False
    status: str = "draft"
    management_group_id: UUID | None = None


class EmploymentUpdate(BaseModel):
    employment_type: str | None = None
    probation_start_date: date | None = None
    probation_end_date: date | None = None
    confirmation_date: date | None = None
    contract_end_date: date | None = None
    notice_period_days: int | None = None
    ctc_amount: Decimal | None = None
    currency_code: str | None = None
    work_location_text: str | None = None
    lifecycle_source: str | None = None
    status: str | None = None
    management_group_id: UUID | None = None
    version: int | None = None


class EmploymentResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    employee_id: UUID
    employment_type: str
    date_of_joining: date
    probation_start_date: date | None = None
    probation_end_date: date | None = None
    confirmation_date: date | None = None
    notice_period_days: int | None = None
    lifecycle_source: str | None = None
    payroll_eligible: bool = False
    management_group_id: UUID | None = None
    status: str
    version: int


class ManagementGroupFeatureCatalogSection(BaseModel):
    id: str
    title: str
    features: list[dict]


class ManagementGroupCreate(BaseModel):
    company_id: UUID | None = None
    group_code: str
    group_name: str
    description: str | None = None
    employment_type: str = "permanent"
    status: str = "active"
    default_shift_id: UUID
    default_shift_rotation_id: UUID | None = None
    default_attendance_rule_id: UUID | None = None
    default_holiday_calendar_id: UUID | None = None
    default_weekly_off_policy_id: UUID | None = None
    feature_toggles_json: dict[str, bool] | None = None


class ManagementGroupUpdate(BaseModel):
    group_name: str | None = None
    description: str | None = None
    employment_type: str | None = None
    status: str | None = None
    default_shift_id: UUID | None = None
    default_shift_rotation_id: UUID | None = None
    default_attendance_rule_id: UUID | None = None
    default_holiday_calendar_id: UUID | None = None
    default_weekly_off_policy_id: UUID | None = None
    feature_toggles_json: dict[str, bool] | None = None
    version: int | None = None


class ManagementGroupResponse(OrmModel):
    id: UUID
    company_id: UUID
    group_code: str
    group_name: str
    description: str | None = None
    employment_type: str
    status: str
    default_shift_id: UUID
    default_shift_rotation_id: UUID | None = None
    default_attendance_rule_id: UUID | None = None
    default_holiday_calendar_id: UUID | None = None
    default_weekly_off_policy_id: UUID | None = None
    feature_toggles_json: dict[str, bool]
    employee_count: int | None = None
    version: int


class EmployeeFeatureAccessResponse(BaseModel):
    employee_id: UUID
    management_group_id: UUID | None = None
    feature_toggles: dict[str, bool]


class ProbationStartRequest(BaseModel):
    probation_days: int = 90


class EmploymentActivateRequest(BaseModel):
    """Manual Emp ID + optional shift at activation (Epic 1)."""

    employee_code: str | None = None
    shift_id: UUID | None = None
    management_group_id: UUID | None = None
    start_probation: bool = True
    probation_days: int = 90
    mark_payroll_eligible: bool = True


class ProbationExtendRequest(BaseModel):
    extra_days: int


class LifecycleEventResponse(OrmModel):
    id: UUID
    employee_id: UUID
    employment_id: UUID | None = None
    from_status: str | None = None
    to_status: str
    event_type: str
    event_at: datetime
    notes: str | None = None
    meta_json: dict | None = None
    company_id: UUID
    branch_id: UUID | None = None


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


class ShiftAssignmentUpdate(BaseModel):
    branch_id: UUID | None = None
    employee_id: UUID | None = None
    shift_id: UUID | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    status: str | None = None
    version: int | None = None


class ShiftAssignmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    employee_id: UUID
    shift_id: UUID
    effective_from: date
    effective_to: date | None = None
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
    carry_forward_allowed: bool = False
    max_carry_forward_days: Decimal | None = None
    encashment_allowed: bool = False
    monthly_credit_days: Decimal | None = None
    leave_cycle_start_day: int = 1
    sandwich_rule_enabled: bool = False
    status: str = "active"


class LeaveTypeUpdate(BaseModel):
    leave_type_name: str | None = None
    is_paid: bool | None = None
    max_days_per_year: Decimal | None = None
    requires_attachment: bool | None = None
    carry_forward_allowed: bool | None = None
    max_carry_forward_days: Decimal | None = None
    encashment_allowed: bool | None = None
    monthly_credit_days: Decimal | None = None
    leave_cycle_start_day: int | None = None
    sandwich_rule_enabled: bool | None = None
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
    carry_forward_allowed: bool = False
    max_carry_forward_days: Decimal | None = None
    encashment_allowed: bool = False
    monthly_credit_days: Decimal | None = None
    leave_cycle_start_day: int = 1
    sandwich_rule_enabled: bool = False
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


class LeaveBalanceUpdate(BaseModel):
    opening_balance: Decimal | None = None
    accrued: Decimal | None = None
    used: Decimal | None = None
    status: str | None = None
    version: int | None = None


class CompOffCreditRequest(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    days: Decimal
    reason: str | None = None
    earned_date: date | None = None


class CarryForwardRequest(BaseModel):
    company_id: UUID | None = None
    from_year: int | None = None
    default_max_days: Decimal = Decimal("5")


class CarryForwardItem(BaseModel):
    employee_id: UUID
    leave_type_id: UUID
    unused_days: Decimal
    carried_days: Decimal
    next_balance_id: UUID | None = None


class CarryForwardResponse(BaseModel):
    from_year: int
    to_year: int
    carried: int
    closed: int
    items: list[CarryForwardItem] = []


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
    reason: str | None = None
    status: str
    version: int


class LeaveAdjustmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    leave_type_id: UUID
    adjustment_month: date
    days_delta: Decimal
    reason: str | None = None
    status: str | None = "draft"


class LeaveAdjustmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    leave_type_id: UUID
    adjustment_month: date
    days_delta: Decimal
    reason: str | None
    status: str
    approved_by: UUID | None
    decided_at: datetime | None
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
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    total_hours: Decimal | None = None
    attendance_status: str
    source: str
    shift_id: UUID | None = None
    late_minutes: int | None = None
    overtime_minutes: int | None = None
    early_leave_minutes: int | None = None
    status: str
    notes: str | None = None
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


class KpiCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    name: str
    department: str = ""
    designation: str | None = None
    weightage: Decimal = Decimal("0")
    target: Decimal = Decimal("0")
    measure_type: str = "number"
    rating_scale: int = 5
    status: str = "active"


class KpiUpdate(BaseModel):
    name: str | None = None
    department: str | None = None
    designation: str | None = None
    weightage: Decimal | None = None
    target: Decimal | None = None
    measure_type: str | None = None
    rating_scale: int | None = None
    status: str | None = None
    version: int | None = None


class KpiResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    name: str
    department: str
    designation: str | None = None
    weightage: Decimal
    target: Decimal
    measure_type: str
    rating_scale: int
    status: str
    version: int


class OkrKeyResultIn(BaseModel):
    title: str
    progress_pct: Decimal = Decimal("0")
    weightage: Decimal = Decimal("1")
    sequence_no: int | None = None


class OkrKeyResultResponse(OrmModel):
    id: UUID
    title: str
    progress_pct: Decimal
    weightage: Decimal
    sequence_no: int
    status: str


class OkrCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    title: str
    owner: str = ""
    department: str = ""
    weightage: Decimal = Decimal("0")
    status: str = "active"
    key_results: list[OkrKeyResultIn] = []


class OkrUpdate(BaseModel):
    title: str | None = None
    owner: str | None = None
    department: str | None = None
    weightage: Decimal | None = None
    status: str | None = None
    key_results: list[OkrKeyResultIn] | None = None
    version: int | None = None


class OkrResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    title: str
    owner: str
    department: str
    weightage: Decimal
    progress_pct: Decimal
    status: str
    version: int
    key_results: list[OkrKeyResultResponse] = []


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
    start_time: time | None = None
    end_time: time | None = None
    room_id: UUID | None = None
    is_recurring: bool = False
    recurrence_rule: str | None = "none"
    notes: str | None = None
    status: str = "planned"
    employee_ids: list[UUID] = []


class TrainingUpdate(BaseModel):
    training_name: str | None = None
    training_type: str | None = None
    trainer_name: str | None = None
    trainer_employee_id: UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    room_id: UUID | None = None
    is_recurring: bool | None = None
    recurrence_rule: str | None = None
    notes: str | None = None
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
    start_time: time | None = None
    end_time: time | None = None
    room_id: UUID | None = None
    is_recurring: bool = False
    recurrence_rule: str | None = None
    notes: str | None = None
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


class TrainingRoomCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    room_code: str | None = None
    room_name: str
    capacity: int = 10
    equipment_json: list | None = None
    notes: str | None = None
    status: str = "active"


class TrainingRoomUpdate(BaseModel):
    room_name: str | None = None
    capacity: int | None = None
    equipment_json: list | None = None
    notes: str | None = None
    status: str | None = None
    version: int | None = None


class TrainingRoomResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    room_code: str
    room_name: str
    capacity: int
    equipment_json: list | None
    notes: str | None
    status: str
    company_id: UUID
    version: int


class TrainingRequestAttendee(BaseModel):
    employee_id: UUID
    employee_name: str | None = None
    employee_code: str | None = None


class TrainingRequestCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    title: str
    request_type: str = "meeting"
    requested_by_employee_id: UUID
    host_employee_id: UUID | None = None
    host_name: str | None = None
    room_id: UUID | None = None
    request_date: date
    start_time: time | None = None
    end_time: time | None = None
    is_recurring: bool = False
    recurrence_rule: str | None = None
    attendees: list[TrainingRequestAttendee] = []
    agenda: str | None = None


class TrainingRequestDecision(BaseModel):
    approval_notes: str | None = None


class TrainingRequestResponse(OrmModel):
    id: UUID
    branch_id: UUID
    request_code: str
    title: str
    request_type: str
    requested_by_employee_id: UUID
    host_employee_id: UUID | None
    host_name: str | None
    room_id: UUID | None
    training_id: UUID | None
    request_date: date
    start_time: time | None
    end_time: time | None
    is_recurring: bool
    recurrence_rule: str | None
    attendees_json: list | None
    agenda: str | None
    approval_notes: str | None
    status: str
    company_id: UUID
    version: int


class EssPolicyAdminCreate(BaseModel):
    company_id: UUID | None = None
    policy_code: str
    title: str
    content_markdown: str
    is_mandatory: bool = True
    display_order: int = 0
    status: str = "draft"


class EssPolicyAdminUpdate(BaseModel):
    title: str | None = None
    content_markdown: str | None = None
    is_mandatory: bool | None = None
    display_order: int | None = None
    status: str | None = None
    version: int | None = None


class EssPolicyAdminResponse(OrmModel):
    id: UUID
    policy_code: str
    title: str
    policy_version: int
    content_markdown: str
    is_mandatory: bool
    display_order: int
    published_at: datetime | None
    status: str
    company_id: UUID
    version: int


class AttendanceCorrectionCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    attendance_date: date
    field_name: str
    new_value: str
    attendance_id: UUID | None = None
    old_value: str | None = None
    reason: str | None = None
    status: str | None = None


class AttendanceCorrectionResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    attendance_id: UUID | None = None
    attendance_date: date
    field_name: str
    old_value: str | None = None
    new_value: str
    reason: str | None = None
    status: str
    version: int


class WeeklyOffPolicyCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    policy_code: str = "WOFF-001"
    policy_name: str = "Default Weekly Off"
    rules_json: list[str] = ["sunday"]
    custom_weekdays_json: list[int] | None = None
    alternate_saturday_start: date | None = None
    is_default: bool = True
    status: str = "active"


class WeeklyOffPolicyUpdate(BaseModel):
    policy_name: str | None = None
    rules_json: list[str] | None = None
    custom_weekdays_json: list[int] | None = None
    alternate_saturday_start: date | None = None
    is_default: bool | None = None
    status: str | None = None
    version: int | None = None


class WeeklyOffPolicyResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID | None = None
    policy_code: str
    policy_name: str
    rules_json: list | None = None
    custom_weekdays_json: list | None = None
    alternate_saturday_start: date | None = None
    is_default: bool
    status: str
    version: int


class WeeklyOffRulesUpsert(BaseModel):
    company_id: UUID | None = None
    rules_json: list[str]
    custom_weekdays_json: list[int] | None = None
    alternate_saturday_start: date | None = None


class ShiftArrivalWindow(BaseModel):
    shift_id: UUID | str | None = None
    shift_code: str | None = None
    window_start: str | None = None  # HH:MM
    ok_until: str | None = None
    after_status: str = "half_day"  # half_day | absent | late


class AttendanceRuleCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    rule_code: str | None = None
    rule_name: str | None = None
    # UI aliases from setup-center
    code: str | None = None
    name: str | None = None
    grace_minutes: int = 15
    late_mark_after_minutes: int | None = None
    late_mark_after: int | None = None
    half_day_hours: Decimal = Decimal("4.00")
    full_day_hours: Decimal = Decimal("8.00")
    early_leave_half_day_minutes: int = 120
    overtime_allowed: bool = True
    geofence_required: bool = False
    miss_punch_window_hours: int = 48
    compoff_half_day_hours: Decimal = Decimal("4.00")
    compoff_full_day_hours: Decimal = Decimal("8.00")
    compoff_auto_credit: bool = True
    punch_mode: str = "first_in_last_out"
    arrival_policy_enabled: bool = False
    applies_to_all_shifts: bool = True
    arrival_window_start: str | None = None
    arrival_ok_until: str | None = None
    arrival_after_status: str = "half_day"
    shift_windows_json: list[ShiftArrivalWindow] | list[dict] | None = None
    is_default: bool = True
    status: str = "active"


class AttendanceRuleUpdate(BaseModel):
    rule_name: str | None = None
    name: str | None = None
    grace_minutes: int | None = None
    late_mark_after_minutes: int | None = None
    late_mark_after: int | None = None
    half_day_hours: Decimal | None = None
    full_day_hours: Decimal | None = None
    early_leave_half_day_minutes: int | None = None
    overtime_allowed: bool | None = None
    geofence_required: bool | None = None
    miss_punch_window_hours: int | None = None
    compoff_half_day_hours: Decimal | None = None
    compoff_full_day_hours: Decimal | None = None
    compoff_auto_credit: bool | None = None
    punch_mode: str | None = None
    arrival_policy_enabled: bool | None = None
    applies_to_all_shifts: bool | None = None
    arrival_window_start: str | None = None
    arrival_ok_until: str | None = None
    arrival_after_status: str | None = None
    shift_windows_json: list[ShiftArrivalWindow] | list[dict] | None = None
    is_default: bool | None = None
    status: str | None = None
    version: int | None = None


class AttendanceRuleResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID | None = None
    rule_code: str
    rule_name: str
    grace_minutes: int
    late_mark_after_minutes: int
    half_day_hours: Decimal
    full_day_hours: Decimal
    early_leave_half_day_minutes: int
    overtime_allowed: bool
    geofence_required: bool
    miss_punch_window_hours: int
    compoff_half_day_hours: Decimal = Decimal("4.00")
    compoff_full_day_hours: Decimal = Decimal("8.00")
    compoff_auto_credit: bool = True
    punch_mode: str = "first_in_last_out"
    arrival_policy_enabled: bool = False
    applies_to_all_shifts: bool = True
    arrival_window_start: time | None = None
    arrival_ok_until: time | None = None
    arrival_after_status: str = "half_day"
    shift_windows_json: list | dict | None = None
    is_default: bool
    status: str
    version: int


class OnDutyRequestCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    duty_date: date
    end_date: date | None = None
    portion: str = "full_day"
    duty_location: str | None = None
    purpose: str | None = None
    reason: str | None = None
    status: str | None = None


class OnDutyRequestResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    duty_date: date
    end_date: date | None = None
    portion: str
    duty_location: str | None = None
    purpose: str | None = None
    reason: str | None = None
    status: str
    version: int


class OtAllotmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    allotment_date: date
    hours: Decimal
    allotment_type: str = "overtime"
    reason: str | None = None
    status: str | None = None


class OtAllotmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    allotment_date: date
    allotment_type: str
    hours: Decimal
    reason: str | None = None
    status: str
    version: int


class CompoffRequestCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    earned_date: date
    extra_hours: Decimal
    requested_days: Decimal | None = None
    reason: str | None = None
    status: str | None = None


class CompoffRequestResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    earned_date: date
    extra_hours: Decimal
    requested_days: Decimal
    reason: str | None = None
    status: str
    manager_approver_id: UUID | None = None
    hr_approver_id: UUID | None = None
    decided_at: datetime | None = None
    version: int


class BiometricDeviceCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    device_code: str
    device_name: str
    device_model: str = "fingerprint_k40_timelabs"
    ip_address: str | None = None
    port: int | None = None
    location_text: str | None = None
    status: str = "active"
    generate_api_key: bool = True


class BiometricDeviceResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    device_code: str
    device_name: str
    device_model: str
    ip_address: str | None = None
    port: int | None = None
    location_text: str | None = None
    status: str
    version: int
    api_key: str | None = None


class BiometricDeviceLiveLogItem(BaseModel):
    id: UUID
    employee_id: UUID
    employee_code: str | None = None
    employee_name: str | None = None
    attendance_date: date
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    attendance_status: str
    notes: str | None = None
    updated_at: datetime | None = None


class BiometricDeviceFeedResponse(BaseModel):
    device: BiometricDeviceResponse
    reachable: bool
    reachability_message: str
    today_ingested_count: int
    ingested_records: list[BiometricDeviceLiveLogItem]


class BiometricPunchIn(BaseModel):
    employee_id: UUID | None = None
    employee_code: str | None = None
    attendance_date: date
    branch_id: UUID | None = None
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    # Raw punch stream — aggregated by attendance-rule punch_mode
    punch_events: list[datetime] | None = None
    attendance_status: str | None = None
    notes: str | None = None
    shift_id: UUID | None = None
    shift_code: str | None = None


class DeviceSyncRequest(BaseModel):
    device_code: str | None = None
    company_id: UUID | None = None
    punches: list[BiometricPunchIn]
    api_key: str | None = None


class DeviceSyncResponse(BaseModel):
    created: int
    updated: int
    skipped: int
    total: int


class ShiftRotationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    rotation_code: str
    rotation_name: str
    cycle: str = "weekly"
    sequence: list[str]
    employee_ids: list[str]
    effective_from: date
    status: str = "active"


class ShiftRotationResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    rotation_code: str
    rotation_name: str
    cycle: str
    sequence_json: str
    employee_ids_json: str
    effective_from: date
    status: str
    version: int


class ShiftSwapCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    swap_date: date
    current_shift_id: UUID | None = None
    requested_shift_id: UUID | None = None
    swap_with_employee_id: UUID | None = None
    reason: str | None = None
    status: str | None = None


class ShiftSwapResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    swap_with_employee_id: UUID | None = None
    current_shift_id: UUID | None = None
    requested_shift_id: UUID | None = None
    swap_date: date
    reason: str | None = None
    status: str
    manager_approver_id: UUID | None = None
    decided_at: datetime | None = None
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


class SeparationChecklistUpdate(BaseModel):
    item_key: str
    done: bool = True
    notes: str | None = None


class SeparationExitInterviewRequest(BaseModel):
    answers: dict
    interviewer_notes: str | None = None


class EmployeeAssetItem(BaseModel):
    id: UUID
    assignment_id: UUID | None = None
    asset_code: str
    asset_name: str
    asset_type: str
    serial_number: str | None = None
    asset_status: str
    assignment_status: str | None = None
    document_number: str | None = None
    allocated_at: datetime | None = None
    expected_return_at: date | None = None
    returned_at: datetime | None = None


class EmployeeAssetOption(BaseModel):
    id: UUID
    asset_code: str
    asset_name: str
    asset_type: str
    serial_number: str | None = None


class EmployeeAssetAssignRequest(BaseModel):
    asset_id: UUID
    branch_id: UUID
    expected_return_at: date | None = None


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
    fnf_status: str = "pending"
    fnf_payroll_run_id: UUID | None = None
    clearance_json: dict | None = None
    version: int


class ReportSummaryResponse(BaseModel):
    company_id: UUID
    attendance_count: int
    leave_request_count: int
    approved_leave_count: int
    separation_count: int
    completed_separation_count: int


class RosterEntryCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_id: UUID
    shift_id: UUID
    roster_date: date
    status: str = "draft"
    notes: str | None = None


class RosterEntryUpdate(BaseModel):
    branch_id: UUID | None = None
    employee_id: UUID | None = None
    shift_id: UUID | None = None
    roster_date: date | None = None
    status: str | None = None
    notes: str | None = None
    version: int | None = None


class RosterEntryResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    employee_id: UUID
    shift_id: UUID
    roster_date: date
    status: str
    notes: str | None = None
    version: int


class HrEssInboxItemResponse(OrmModel):
    """HR-facing unified inbox row for ESS submissions and approval outcomes."""

    id: str
    source_id: UUID
    category: str
    status: str
    title: str
    employee_id: UUID
    employee_name: str
    document_number: str | None = None
    occurred_at: datetime
    detail: str
    pending: bool
    available_actions: list[str]
    api_path: str
