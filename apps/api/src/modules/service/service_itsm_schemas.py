"""Pydantic schemas for ITSM enhancements: customer priority SLAs and dashboard analytics."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from modules.service.service_request_ticket_schemas import OrmModel, ServiceSlaComplianceSummary

CALENDAR_TYPES = ("calendar", "working")


# --- Customer + priority SLA policies ---

class CustomerPrioritySlaCreate(BaseModel):
    company_id: UUID | None = None
    customer_id: UUID
    priority: str = Field(..., min_length=1, max_length=20)
    duration_minutes: int | None = Field(None, gt=0)
    # Alternative to duration_minutes: value + unit (minutes | hours | days)
    duration: int | None = Field(None, gt=0)
    duration_unit: str | None = Field(None, pattern="^(minutes|hours|days)$")
    calendar_type: str = Field("calendar", pattern="^(calendar|working)$")
    effective_from: date | None = None
    effective_to: date | None = None
    escalation_json: dict | list | None = None
    sla_id: UUID | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def _validate(self) -> "CustomerPrioritySlaCreate":
        if self.duration_minutes is None and self.duration is None:
            raise ValueError("Provide duration_minutes or duration + duration_unit")
        if self.duration is not None and self.duration_unit is None:
            raise ValueError("duration_unit is required with duration")
        if self.effective_from and self.effective_to and self.effective_to < self.effective_from:
            raise ValueError("effective_to cannot be before effective_from")
        return self


class CustomerPrioritySlaUpdate(BaseModel):
    version: int | None = None
    priority: str | None = Field(None, min_length=1, max_length=20)
    duration_minutes: int | None = Field(None, gt=0)
    duration: int | None = Field(None, gt=0)
    duration_unit: str | None = Field(None, pattern="^(minutes|hours|days)$")
    calendar_type: str | None = Field(None, pattern="^(calendar|working)$")
    effective_from: date | None = None
    effective_to: date | None = None
    escalation_json: dict | list | None = None
    sla_id: UUID | None = None
    is_active: bool | None = None


class CustomerPrioritySlaResponse(OrmModel):
    id: UUID
    company_id: UUID
    customer_id: UUID
    customer_name: str | None = None
    priority: str
    duration_minutes: int
    calendar_type: str
    effective_from: date | None = None
    effective_to: date | None = None
    escalation_json: dict | list | None = None
    sla_id: UUID | None = None
    is_active: bool
    version: int
    created_at: datetime


# --- Dashboard analytics ---

class DashboardCountItem(BaseModel):
    key: str
    label: str
    count: int


class DashboardCustomerItem(BaseModel):
    customer_id: UUID
    customer_name: str | None = None
    total: int
    open: int


class DashboardEngineerWorkload(BaseModel):
    owner_employee_id: UUID
    owner_name: str | None = None
    open_tickets: int
    breached_tickets: int = 0


class DashboardRepeatedCircuit(BaseModel):
    ckt_id: str
    customer_id: UUID | None = None
    customer_name: str | None = None
    ticket_count: int
    last_ticket_at: datetime | None = None


class DashboardTrendPoint(BaseModel):
    period_start: date
    created: int
    resolved: int
    closed: int


class ServiceDashboardSummary(BaseModel):
    total_tickets: int
    open_tickets: int
    unassigned_tickets: int
    pending_reopen_requests: int
    by_status: list[DashboardCountItem]
    by_priority: list[DashboardCountItem]
    by_customer: list[DashboardCustomerItem]
    engineer_workload: list[DashboardEngineerWorkload]
    repeated_circuits: list[DashboardRepeatedCircuit]
    trend: list[DashboardTrendPoint]
    trend_granularity: str
    sla: ServiceSlaComplianceSummary
    date_from: datetime | None = None
    date_to: datetime | None = None
