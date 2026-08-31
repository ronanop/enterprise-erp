"""Non-IT Pydantic schemas."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Asset types ---


class NonItAssetTypeCreate(BaseModel):
    company_id: UUID | None = None
    name: str = Field(min_length=1, max_length=100)
    prefix: str = Field(min_length=1, max_length=20)
    assignment_mode: str
    category: str = "OTHER"
    description: str | None = None
    active: bool = True
    metadata: dict | None = None


class NonItAssetTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    prefix: str | None = Field(default=None, min_length=1, max_length=20)
    assignment_mode: str | None = None
    category: str | None = None
    description: str | None = None
    active: bool | None = None
    metadata: dict | None = None
    version: int | None = None


class NonItAssetTypeResponse(OrmModel):
    id: UUID
    name: str
    prefix: str
    active: bool
    assignment_mode: str
    category: str
    description: str | None = None
    metadata: dict | None = None
    company_id: UUID
    version: int


class NonItAssetTypeListResult(BaseModel):
    items: list[NonItAssetTypeResponse]
    total: int


class NonItNextCodePreviewResponse(BaseModel):
    asset_type_id: UUID
    provisional_code: str


# --- Locations ---


class NonItLocationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    location_kind: str = "OTHER"
    code: str | None = Field(default=None, max_length=40)
    building: str | None = Field(default=None, max_length=120)
    floor: str | None = Field(default=None, max_length=40)
    remarks: str | None = None
    active: bool = True


class NonItLocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    location_kind: str | None = None
    code: str | None = Field(default=None, max_length=40)
    building: str | None = Field(default=None, max_length=120)
    floor: str | None = Field(default=None, max_length=40)
    remarks: str | None = None
    active: bool | None = None
    version: int | None = None


class NonItLocationResponse(OrmModel):
    id: UUID
    name: str
    location_kind: str
    code: str | None = None
    building: str | None = None
    floor: str | None = None
    remarks: str | None = None
    active: bool
    company_id: UUID
    branch_id: UUID
    version: int


class NonItLocationListResult(BaseModel):
    items: list[NonItLocationResponse]
    total: int


# --- Assets ---


class NonItAssetCreate(BaseModel):
    asset_type_id: UUID
    status: str = "IN_STOCK"
    serial_number: str | None = None
    condition: str | None = None
    purchase_date: date | None = None
    remarks: str | None = None
    current_employee_id: UUID | None = None
    current_location_id: UUID | None = None
    company_id: UUID | None = None
    branch_id: UUID | None = None


class NonItAssignRequest(BaseModel):
    employee_id: UUID | None = None
    location_id: UUID | None = None
    version: int | None = None
    remarks: str | None = None

    @model_validator(mode="after")
    def one_holder(self):
        if bool(self.employee_id) == bool(self.location_id):
            raise ValueError("Provide exactly one of employee_id or location_id")
        return self


class NonItUnassignRequest(BaseModel):
    version: int | None = None
    remarks: str | None = None


class NonItMaintenanceStartRequest(BaseModel):
    maintenance_reason: str = Field(min_length=1, max_length=255)
    maintenance_notes: str | None = None
    maintenance_provider: str | None = Field(default=None, max_length=255)
    maintenance_cost: Decimal | None = None
    version: int | None = None


class NonItMaintenanceCompleteRequest(BaseModel):
    completion_notes: str | None = None
    completion_date: date | None = None
    restore_prior_holder: bool = False
    version: int | None = None


class NonItDisposeRequest(BaseModel):
    disposal_reason: str = Field(min_length=1, max_length=255)
    disposal_date: date | None = None
    remarks: str | None = None
    version: int | None = None


class NonItTimelineEventResponse(BaseModel):
    id: UUID
    event_type: str
    event_data: dict | None = None
    occurred_at: datetime
    actor_user_id: UUID | None = None
    remarks: str | None = None
    summary: str


class NonItAssetResponse(OrmModel):
    id: UUID
    asset_code: str
    asset_type_id: UUID
    asset_type_name: str | None = None
    asset_type_prefix: str | None = None
    assignment_mode: str | None = None
    status: str
    serial_number: str | None = None
    condition: str | None = None
    current_employee_id: UUID | None = None
    current_employee_name: str | None = None
    current_location_id: UUID | None = None
    current_location_name: str | None = None
    assignment_display: str | None = None
    purchase_date: date | None = None
    remarks: str | None = None
    maintenance_reason: str | None = None
    maintenance_notes: str | None = None
    maintenance_started_at: datetime | None = None
    maintenance_provider: str | None = None
    maintenance_cost: Decimal | None = None
    disposal_reason: str | None = None
    disposal_date: date | None = None
    prior_holder_available: bool = False
    prior_holder_label: str | None = None
    company_id: UUID
    branch_id: UUID | None = None
    version: int
    created_at: datetime | None = None
    timeline: list[NonItTimelineEventResponse] | None = None


class NonItAssetListResult(BaseModel):
    items: list[NonItAssetResponse]
    total: int
    page: int
    page_size: int


class NonItImportRow(BaseModel):
    asset_type: str = Field(min_length=1, description="Asset type name")
    quantity: int = Field(ge=1, le=5000)


class NonItImportRequest(BaseModel):
    rows: list[NonItImportRow] = Field(min_length=1)
    company_id: UUID | None = None
    branch_id: UUID | None = None


class NonItImportLineSummary(BaseModel):
    asset_type: str
    requested: int
    created: int


class NonItImportSummary(BaseModel):
    lines: list[NonItImportLineSummary]
    total_created: int


# --- Dashboard summary (read-only aggregation) ---


class NonItStatusCount(BaseModel):
    status: str
    count: int
    pct_of_total: float


class NonItTypeCount(BaseModel):
    asset_type_id: UUID
    name: str
    prefix: str
    count: int


class NonItLocationCount(BaseModel):
    location_id: UUID
    name: str
    count: int


class NonItDashboardSummaryResponse(BaseModel):
    company_id: UUID
    total_assets: int
    in_stock: int
    assigned: int
    in_maintenance: int
    disposed: int
    by_status: list[NonItStatusCount]
    by_type: list[NonItTypeCount]
    by_location: list[NonItLocationCount] = Field(default_factory=list)
