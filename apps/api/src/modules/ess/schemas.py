"""ESS request/response schemas."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class EssMeResponse(BaseModel):
    employee_id: UUID
    company_id: UUID
    branch_id: UUID
    department_id: UUID
    employee_code: str
    first_name: str
    last_name: str
    email: str
    mobile: str
    designation: str
    date_of_joining: date
    status: str
    display_name: str


class EssMeUpdate(BaseModel):
    mobile: str | None = None


class EssLeaveRequestCreate(BaseModel):
    leave_type_id: UUID
    start_date: date
    end_date: date
    days_count: Decimal = Field(gt=0)
    reason: str | None = None


class EssLeaveTypeResponse(OrmModel):
    id: UUID
    leave_type_code: str
    leave_type_name: str
    is_paid: bool
    max_days_per_year: Decimal | None
    monthly_credit_days: Decimal | None = None
    status: str


class EssLeaveBalanceResponse(OrmModel):
    id: UUID
    leave_type_id: UUID
    balance_year: int
    opening_balance: Decimal
    accrued: Decimal
    used: Decimal
    closing_balance: Decimal
    status: str


class EssLeaveRequestResponse(OrmModel):
    id: UUID
    document_number: str
    leave_type_id: UUID
    start_date: date
    end_date: date
    days_count: Decimal
    reason: str | None = None
    status: str


class EssAttendanceResponse(BaseModel):
    id: UUID
    attendance_date: date
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    total_hours: Decimal | None = None
    attendance_status: str
    source: str
    status: str


class EssPunchRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None


class EssPunchResponse(BaseModel):
    action: str
    attendance: EssAttendanceResponse


class EssBankResponse(BaseModel):
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    bank_account_holder: str | None = None


class EssBankUpdate(BaseModel):
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    bank_account_holder: str | None = None


class EssKycResponse(BaseModel):
    aadhaar_number: str | None = None
    pan_number: str | None = None
    uan_number: str | None = None


class EssDocumentResponse(OrmModel):
    id: UUID
    document_number: str
    document_type: str
    document_name: str
    storage_uri: str
    issued_on: date | None = None
    expires_on: date | None = None
    verification_status: str
    status: str


class EssHolidayCalendarResponse(OrmModel):
    id: UUID
    calendar_code: str
    calendar_name: str
    calendar_year: int
    holidays_json: list | dict | None = None
    status: str
    branch_id: UUID | None = None


class EssNotificationResponse(BaseModel):
    id: UUID
    title: str
    body: str
    kind: str
    read: bool
    created_at: datetime


class EssPayslipSummary(BaseModel):
    id: UUID
    document_number: str
    employee_code: str | None = None
    employee_name: str | None = None
    payroll_period_id: UUID
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    issued_at: datetime | None = None
    delivery_status: str
    payment_status: str
    status: str


class EssPayslipDetail(EssPayslipSummary):
    payslip_json: dict | None = None
    company_id: UUID
    branch_id: UUID


class EssEmergencyContactResponse(BaseModel):
    name: str | None = None
    mobile: str | None = None
    blood_group: str | None = None
    relationship: str | None = None


class EssEmergencyUpdate(BaseModel):
    emergency_contact_name: str | None = None
    emergency_contact_mobile: str | None = None


class EssEducationItem(BaseModel):
    id: str | None = None
    degree: str
    institution: str | None = None
    field_of_study: str | None = None
    start_year: int | None = None
    end_year: int | None = None
    grade: str | None = None


class EssSkillItem(BaseModel):
    id: str | None = None
    name: str
    level: str | None = None
    years: float | None = None


class EssEducationSkillsResponse(BaseModel):
    education: list[EssEducationItem] = []
    skills: list[EssSkillItem] = []


class EssEducationSkillsUpdate(BaseModel):
    education: list[EssEducationItem] | None = None
    skills: list[EssSkillItem] | None = None


class EssTeamLeaveItem(BaseModel):
    id: UUID
    employee_id: UUID
    employee_code: str
    display_name: str
    document_number: str
    start_date: date
    end_date: date
    days_count: Decimal
    status: str


class EssAnnouncementItem(BaseModel):
    id: str
    title: str
    body: str
    tag: str = "News"
    pinned: bool = False
    published_on: date | None = None


class EssAssetItem(BaseModel):
    id: UUID
    asset_code: str
    asset_name: str
    asset_type: str
    serial_number: str | None = None
    status: str
    assignment_status: str | None = None


class EssTrainingItem(BaseModel):
    id: UUID
    training_id: UUID
    training_code: str
    training_name: str
    training_type: str | None = None
    start_date: date | None = None
    attendance_status: str
    status: str


class EssPerformanceItem(BaseModel):
    id: UUID
    document_number: str
    review_cycle: str
    period_start: date | None = None
    period_end: date | None = None
    overall_rating: int | None = None
    status: str


class EssSeparationItem(BaseModel):
    id: UUID
    document_number: str
    separation_type: str
    requested_last_working_date: date
    status: str
    fnf_status: str | None = None


class EssSeparationCreate(BaseModel):
    separation_type: str = "resignation"
    requested_last_working_date: date
    reason: str | None = None


class EssAttendanceCorrectionCreate(BaseModel):
    attendance_date: date
    field_name: str = "check_out"
    new_value: str
    reason: str | None = None
    attendance_id: UUID | None = None
    old_value: str | None = None
    submit: bool = True


class EssAttendanceCorrectionResponse(OrmModel):
    id: UUID
    attendance_date: date
    field_name: str
    old_value: str | None = None
    new_value: str
    reason: str | None = None
    status: str
    attendance_id: UUID | None = None


class EssOnDutyCreate(BaseModel):
    duty_date: date
    end_date: date | None = None
    portion: str = "full_day"
    duty_location: str | None = None
    purpose: str | None = None
    reason: str | None = None


class EssOnDutyResponse(OrmModel):
    id: UUID
    duty_date: date
    end_date: date | None = None
    portion: str
    duty_location: str | None = None
    purpose: str | None = None
    reason: str | None = None
    status: str


class EssCompoffCreate(BaseModel):
    earned_date: date
    extra_hours: float
    requested_days: float | None = None
    reason: str | None = None


class EssCompoffResponse(OrmModel):
    id: UUID
    earned_date: date
    extra_hours: float
    requested_days: float
    reason: str | None = None
    status: str


class EssDeviceTokenRegister(BaseModel):
    token: str
    platform: str = "web"
