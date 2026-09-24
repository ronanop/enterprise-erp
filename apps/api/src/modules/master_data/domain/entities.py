"""Master Data domain entities."""

from dataclasses import dataclass
from datetime import date
from uuid import UUID


@dataclass(kw_only=True)
class MasterRecordEntity:
    id: UUID
    tenant_id: UUID
    company_id: UUID
    status: str
    version: int = 1
    is_deleted: bool = False


@dataclass(kw_only=True)
class EmployeeEntity(MasterRecordEntity):
    branch_id: UUID
    department_id: UUID
    employee_code: str
    first_name: str
    last_name: str
    email: str
    mobile: str
    designation: str
    date_of_joining: date
    reporting_manager_id: UUID | None = None
    date_of_leaving: date | None = None
    user_id: UUID | None = None
    is_hiring_manager: bool = False
    is_recruiter: bool = False
    is_hr: bool = False


@dataclass(kw_only=True)
class CustomerEntity(MasterRecordEntity):
    branch_id: UUID
    customer_code: str
    customer_name: str
    customer_type: str
    billing_address_json: dict
    shipping_address_json: dict | None = None
    tax_number: str | None = None
    email: str | None = None
    mobile: str | None = None
    credit_limit: float | None = None
    currency_code: str | None = None


@dataclass(kw_only=True)
class VendorEntity(MasterRecordEntity):
    branch_id: UUID
    vendor_code: str
    vendor_name: str
    vendor_type: str
    tax_number: str | None = None
    email: str | None = None
    mobile: str | None = None
    payment_terms: str | None = None
    address_json: dict | None = None


@dataclass(kw_only=True)
class ProductEntity(MasterRecordEntity):
    product_code: str
    product_name: str
    product_type: str
    uom_id: UUID
    branch_id: UUID | None = None
    category_id: UUID | None = None
    tax_id: UUID | None = None
    barcode: str | None = None
    is_inventory_tracked: bool = True


@dataclass(kw_only=True)
class CategoryEntity(MasterRecordEntity):
    category_code: str
    category_name: str
    parent_category_id: UUID | None = None
    level: int = 1
    path: str | None = None


@dataclass(kw_only=True)
class UomEntity(MasterRecordEntity):
    uom_code: str
    uom_name: str
    uom_type: str
    decimal_places: int = 2
    is_base_uom: bool = False


@dataclass(kw_only=True)
class CurrencyEntity(MasterRecordEntity):
    currency_code: str
    currency_name: str
    symbol: str | None = None
    decimal_places: int = 2
    is_base_currency: bool = False
    exchange_rate: float | None = None
    rate_effective_date: date | None = None


@dataclass(kw_only=True)
class TaxEntity(MasterRecordEntity):
    tax_code: str
    tax_name: str
    tax_type: str
    rate_percent: float
    effective_from: date
    is_compound: bool = False
    effective_to: date | None = None


@dataclass(kw_only=True)
class AssetEntity(MasterRecordEntity):
    branch_id: UUID
    asset_code: str
    asset_name: str
    asset_category: str
    serial_number: str | None = None
    purchase_date: date | None = None
    purchase_value: float | None = None
    location_id: UUID | None = None
    custodian_employee_id: UUID | None = None


@dataclass(kw_only=True)
class WarehouseEntity(MasterRecordEntity):
    branch_id: UUID
    warehouse_code: str
    warehouse_name: str
    warehouse_type: str
    location_id: UUID | None = None
    is_default: bool = False
    address_json: dict | None = None
