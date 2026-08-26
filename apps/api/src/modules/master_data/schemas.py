"""Pydantic schemas for master data APIs."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AddressContactJson(BaseModel):
    """Primary contact nested under vendor/customer address_json."""

    first_name: str | None = None
    last_name: str | None = None


class AddressJson(BaseModel):
    """Billing/shipping address payload.

    Defaults keep list/get responses working when legacy rows stored `{}`.
    Extra keys (billing/shipping/addresses) are preserved so vendor forms
    can round-trip contact and multi-address payloads.
    """

    model_config = ConfigDict(extra="allow")

    line1: str = "TBD"
    city: str = "TBD"
    country_code: str = Field(default="IN", max_length=3)
    state: str | None = None
    postal_code: str | None = None
    contact: AddressContactJson | None = None


class SubmitApprovalRequest(BaseModel):
    instance_id: UUID | None = None


class WorkflowInstanceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    workflow_id: UUID
    entity_name: str
    entity_id: UUID
    status: str
    started_at: datetime
    started_by: UUID
    current_step_id: UUID | None = None
    company_id: UUID | None = None


class EmployeeCreateRequest(BaseModel):
    branch_id: UUID
    department_id: UUID
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    email: str = Field(max_length=255)
    mobile: str = Field(max_length=30)
    designation: str = Field(max_length=100)
    date_of_joining: date
    company_id: UUID | None = None
    employee_code: str | None = Field(default=None, max_length=50)
    reporting_manager_id: UUID | None = None
    date_of_leaving: date | None = None
    user_id: UUID | None = None
    bypass_onboarding: bool = False


class EmployeeUpdateRequest(BaseModel):
    version: int
    branch_id: UUID | None = None
    department_id: UUID | None = None
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    mobile: str | None = Field(default=None, max_length=30)
    designation: str | None = Field(default=None, max_length=100)
    date_of_joining: date | None = None
    reporting_manager_id: UUID | None = None
    date_of_leaving: date | None = None
    user_id: UUID | None = None
    status: str | None = None


class EmployeeResponse(BaseModel):
    id: UUID
    tenant_id: UUID
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
    version: int
    is_deleted: bool
    reporting_manager_id: UUID | None = None
    date_of_leaving: date | None = None
    user_id: UUID | None = None


class CustomerCreateRequest(BaseModel):
    branch_id: UUID
    customer_name: str = Field(max_length=255)
    customer_type: str
    billing_address_json: AddressJson
    company_id: UUID | None = None
    customer_code: str | None = Field(default=None, max_length=50)
    shipping_address_json: AddressJson | None = None
    tax_number: str | None = None
    email: str | None = None
    mobile: str | None = None
    credit_limit: float | None = None
    currency_code: str | None = Field(default=None, max_length=3)


class CustomerUpdateRequest(BaseModel):
    version: int
    branch_id: UUID | None = None
    customer_name: str | None = Field(default=None, max_length=255)
    customer_type: str | None = None
    billing_address_json: AddressJson | None = None
    shipping_address_json: AddressJson | None = None
    tax_number: str | None = None
    email: str | None = None
    mobile: str | None = None
    credit_limit: float | None = None
    currency_code: str | None = Field(default=None, max_length=3)
    status: str | None = None


class CustomerResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    branch_id: UUID
    customer_code: str
    customer_name: str
    customer_type: str
    billing_address_json: AddressJson
    status: str
    version: int
    is_deleted: bool
    shipping_address_json: AddressJson | None = None
    tax_number: str | None = None
    email: str | None = None
    mobile: str | None = None
    credit_limit: float | None = None
    currency_code: str | None = None


class VendorCreateRequest(BaseModel):
    branch_id: UUID
    vendor_name: str = Field(max_length=255)
    vendor_type: str
    company_id: UUID | None = None
    vendor_code: str | None = Field(default=None, max_length=50)
    tax_number: str | None = None
    email: str | None = None
    mobile: str | None = None
    payment_terms: str | None = None
    address_json: AddressJson | None = None


class VendorUpdateRequest(BaseModel):
    version: int
    branch_id: UUID | None = None
    vendor_name: str | None = Field(default=None, max_length=255)
    vendor_type: str | None = None
    tax_number: str | None = None
    email: str | None = None
    mobile: str | None = None
    payment_terms: str | None = None
    address_json: AddressJson | None = None
    status: str | None = None


class VendorResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    branch_id: UUID
    vendor_code: str
    vendor_name: str
    vendor_type: str
    status: str
    version: int
    is_deleted: bool
    tax_number: str | None = None
    email: str | None = None
    mobile: str | None = None
    payment_terms: str | None = None
    address_json: AddressJson | None = None


class ProductCreateRequest(BaseModel):
    product_name: str = Field(max_length=255)
    product_type: str
    uom_id: UUID
    company_id: UUID | None = None
    product_code: str | None = Field(default=None, max_length=50)
    branch_id: UUID | None = None
    category_id: UUID | None = None
    tax_id: UUID | None = None
    barcode: str | None = None
    is_inventory_tracked: bool = True


class ProductUpdateRequest(BaseModel):
    version: int
    product_name: str | None = Field(default=None, max_length=255)
    product_type: str | None = None
    uom_id: UUID | None = None
    branch_id: UUID | None = None
    category_id: UUID | None = None
    tax_id: UUID | None = None
    barcode: str | None = None
    is_inventory_tracked: bool | None = None
    status: str | None = None


class ProductResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    product_code: str
    product_name: str
    product_type: str
    uom_id: UUID
    status: str
    version: int
    is_deleted: bool
    is_inventory_tracked: bool
    branch_id: UUID | None = None
    category_id: UUID | None = None
    tax_id: UUID | None = None
    barcode: str | None = None


class CategoryCreateRequest(BaseModel):
    category_name: str = Field(max_length=255)
    company_id: UUID | None = None
    category_code: str | None = Field(default=None, max_length=50)
    parent_category_id: UUID | None = None
    level: int = 1
    path: str | None = None


class CategoryUpdateRequest(BaseModel):
    version: int
    category_name: str | None = Field(default=None, max_length=255)
    parent_category_id: UUID | None = None
    level: int | None = None
    path: str | None = None
    status: str | None = None


class CategoryResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    category_code: str
    category_name: str
    status: str
    version: int
    is_deleted: bool
    parent_category_id: UUID | None = None
    level: int = 1
    path: str | None = None


class CategoryTreeNode(BaseModel):
    id: UUID
    category_code: str
    category_name: str
    status: str
    parent_category_id: UUID | None = None
    level: int
    children: list["CategoryTreeNode"] = Field(default_factory=list)


class UomCreateRequest(BaseModel):
    uom_code: str = Field(max_length=20)
    uom_name: str = Field(max_length=100)
    uom_type: str
    company_id: UUID | None = None
    decimal_places: int = 2
    is_base_uom: bool = False


class UomUpdateRequest(BaseModel):
    version: int
    uom_name: str | None = Field(default=None, max_length=100)
    uom_type: str | None = None
    decimal_places: int | None = None
    is_base_uom: bool | None = None
    status: str | None = None


class UomResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    uom_code: str
    uom_name: str
    uom_type: str
    decimal_places: int
    is_base_uom: bool
    status: str
    version: int
    is_deleted: bool


class CurrencyCreateRequest(BaseModel):
    currency_code: str = Field(max_length=3)
    currency_name: str = Field(max_length=100)
    company_id: UUID | None = None
    symbol: str | None = None
    decimal_places: int = 2
    is_base_currency: bool = False
    exchange_rate: float | None = None
    rate_effective_date: date | None = None


class CurrencyUpdateRequest(BaseModel):
    version: int
    currency_name: str | None = Field(default=None, max_length=100)
    symbol: str | None = None
    decimal_places: int | None = None
    is_base_currency: bool | None = None
    exchange_rate: float | None = None
    rate_effective_date: date | None = None
    status: str | None = None


class CurrencyResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    currency_code: str
    currency_name: str
    decimal_places: int
    is_base_currency: bool
    status: str
    version: int
    is_deleted: bool
    symbol: str | None = None
    exchange_rate: float | None = None
    rate_effective_date: date | None = None


class TaxCreateRequest(BaseModel):
    tax_name: str = Field(max_length=100)
    tax_type: str
    rate_percent: float
    effective_from: date
    company_id: UUID | None = None
    tax_code: str | None = Field(default=None, max_length=50)
    is_compound: bool = False
    effective_to: date | None = None


class TaxUpdateRequest(BaseModel):
    version: int
    tax_name: str | None = Field(default=None, max_length=100)
    tax_type: str | None = None
    rate_percent: float | None = None
    effective_from: date | None = None
    is_compound: bool | None = None
    effective_to: date | None = None
    status: str | None = None


class TaxResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    tax_code: str
    tax_name: str
    tax_type: str
    rate_percent: float
    effective_from: date
    is_compound: bool
    status: str
    version: int
    is_deleted: bool
    effective_to: date | None = None


class AssetCreateRequest(BaseModel):
    branch_id: UUID
    asset_name: str = Field(max_length=255)
    asset_category: str
    company_id: UUID | None = None
    asset_code: str | None = Field(default=None, max_length=50)
    serial_number: str | None = None
    purchase_date: date | None = None
    purchase_value: float | None = None
    location_id: UUID | None = None
    custodian_employee_id: UUID | None = None


class AssetUpdateRequest(BaseModel):
    version: int
    branch_id: UUID | None = None
    asset_name: str | None = Field(default=None, max_length=255)
    asset_category: str | None = None
    serial_number: str | None = None
    purchase_date: date | None = None
    purchase_value: float | None = None
    location_id: UUID | None = None
    custodian_employee_id: UUID | None = None
    status: str | None = None


class AssetResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    branch_id: UUID
    asset_code: str
    asset_name: str
    asset_category: str
    status: str
    version: int
    is_deleted: bool
    serial_number: str | None = None
    purchase_date: date | None = None
    purchase_value: float | None = None
    location_id: UUID | None = None
    custodian_employee_id: UUID | None = None


class WarehouseCreateRequest(BaseModel):
    branch_id: UUID
    warehouse_name: str = Field(max_length=255)
    warehouse_type: str
    company_id: UUID | None = None
    warehouse_code: str | None = Field(default=None, max_length=50)
    location_id: UUID | None = None
    is_default: bool = False
    address_json: AddressJson | None = None


class WarehouseUpdateRequest(BaseModel):
    version: int
    branch_id: UUID | None = None
    warehouse_name: str | None = Field(default=None, max_length=255)
    warehouse_type: str | None = None
    location_id: UUID | None = None
    is_default: bool | None = None
    address_json: AddressJson | None = None
    status: str | None = None


class WarehouseResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    branch_id: UUID
    warehouse_code: str
    warehouse_name: str
    warehouse_type: str
    is_default: bool
    status: str
    version: int
    is_deleted: bool
    location_id: UUID | None = None
    address_json: AddressJson | None = None


CategoryTreeNode.model_rebuild()
