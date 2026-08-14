"""Pydantic schemas for organization APIs."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CompanyCreateRequest(BaseModel):
    company_code: str = Field(max_length=50)
    company_name: str = Field(max_length=255)
    legal_name: str = Field(max_length=255)
    country_code: str = Field(max_length=3)
    currency_code: str = Field(max_length=3)
    registration_number: str | None = None
    tax_number: str | None = None
    fiscal_year_start_month: int = 4
    timezone: str = "UTC"


class CompanyUpdateRequest(BaseModel):
    company_name: str | None = None
    legal_name: str | None = None
    status: str | None = None
    timezone: str | None = None


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    tenant_id: UUID
    company_code: str
    company_name: str
    legal_name: str
    country_code: str
    currency_code: str
    status: str
    fiscal_year_start_month: int
    timezone: str
    created_at: datetime | None = None
    created_by: UUID | None = None
    updated_at: datetime | None = None
    updated_by: UUID | None = None


class BranchCreateRequest(BaseModel):
    company_id: UUID
    branch_code: str
    branch_name: str
    branch_type: str = "regional"
    address_line1: str | None = None
    city: str | None = None
    state_code: str | None = None
    country_code: str | None = None
    head_employee_id: UUID | None = None


class BranchUpdateRequest(BaseModel):
    branch_name: str | None = None
    branch_type: str | None = None
    status: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state_code: str | None = None
    country_code: str | None = None
    head_employee_id: UUID | None = None


class BranchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    tenant_id: UUID
    company_id: UUID
    branch_code: str
    branch_name: str
    branch_type: str
    status: str
    address_line1: str | None = None
    city: str | None = None
    state_code: str | None = None
    country_code: str | None = None
    head_employee_id: UUID | None = None
    created_at: datetime | None = None
    created_by: UUID | None = None
    updated_at: datetime | None = None
    updated_by: UUID | None = None


class DepartmentCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    department_code: str
    department_name: str
    parent_department_id: UUID | None = None
    head_employee_id: UUID | None = None


class DepartmentUpdateRequest(BaseModel):
    department_name: str | None = None
    status: str | None = None
    parent_department_id: UUID | None = None
    head_employee_id: UUID | None = None


class BusinessUnitCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    business_unit_code: str
    business_unit_name: str
    description: str | None = None


class LocationCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    location_code: str
    location_name: str
    location_type: str = "office"
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_meters: int | None = None


class LocationUpdateRequest(BaseModel):
    location_name: str | None = None
    location_type: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_meters: int | None = None
    status: str | None = None


class CostCenterCreateRequest(BaseModel):
    company_id: UUID
    cost_center_code: str
    cost_center_name: str
    valid_from: date
    branch_id: UUID | None = None
    department_id: UUID | None = None


class ProfitCenterCreateRequest(BaseModel):
    company_id: UUID
    profit_center_code: str
    profit_center_name: str
    valid_from: date
    branch_id: UUID | None = None
    department_id: UUID | None = None


class ContextSwitchRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
