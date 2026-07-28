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


class EssPunchResponse(BaseModel):
    action: str
    attendance: EssAttendanceResponse


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
