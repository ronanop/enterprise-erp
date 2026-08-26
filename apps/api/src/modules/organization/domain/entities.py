"""Organization domain entities."""

from dataclasses import dataclass
from datetime import date
from uuid import UUID


@dataclass
class CompanyEntity:
    id: UUID
    tenant_id: UUID
    company_code: str
    company_name: str
    legal_name: str
    country_code: str
    currency_code: str
    status: str
    fiscal_year_start_month: int = 4
    timezone: str = "UTC"
    version: int = 1
    is_deleted: bool = False


@dataclass
class BranchEntity:
    id: UUID
    tenant_id: UUID
    company_id: UUID
    branch_code: str
    branch_name: str
    branch_type: str
    status: str
    version: int = 1
    is_deleted: bool = False


@dataclass
class DepartmentEntity:
    id: UUID
    tenant_id: UUID
    company_id: UUID
    branch_id: UUID
    department_code: str
    department_name: str
    status: str
    parent_department_id: UUID | None = None
    version: int = 1


@dataclass
class BusinessUnitEntity:
    id: UUID
    tenant_id: UUID
    company_id: UUID
    branch_id: UUID
    business_unit_code: str
    business_unit_name: str
    status: str
    description: str | None = None
    version: int = 1


@dataclass
class LocationEntity:
    id: UUID
    tenant_id: UUID
    company_id: UUID
    branch_id: UUID
    location_code: str
    location_name: str
    location_type: str
    status: str
    version: int = 1
    branch_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_meters: int | None = None


@dataclass
class CostCenterEntity:
    id: UUID
    tenant_id: UUID
    company_id: UUID
    cost_center_code: str
    cost_center_name: str
    valid_from: date
    status: str
    branch_id: UUID | None = None
    department_id: UUID | None = None
    valid_to: date | None = None
    version: int = 1


@dataclass
class ProfitCenterEntity:
    id: UUID
    tenant_id: UUID
    company_id: UUID
    profit_center_code: str
    profit_center_name: str
    valid_from: date
    status: str
    branch_id: UUID | None = None
    department_id: UUID | None = None
    valid_to: date | None = None
    version: int = 1
