"""Master Data domain enums."""

from enum import Enum


class EmployeeStatus(str, Enum):
    DRAFT = "draft"
    ONBOARDING = "onboarding"
    ACTIVE = "active"
    PROBATION = "probation"
    ON_LEAVE = "on_leave"
    NOTICE_PERIOD = "notice_period"
    RESIGNED = "resigned"
    TERMINATED = "terminated"
    EX_EMPLOYEE = "ex_employee"


class CustomerType(str, Enum):
    INDIVIDUAL = "individual"
    CORPORATE = "corporate"
    GOVERNMENT = "government"


class CustomerStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    BLOCKED = "blocked"


class VendorType(str, Enum):
    DOMESTIC = "domestic"
    INTERNATIONAL = "international"
    SERVICE = "service"


class ProductType(str, Enum):
    GOODS = "goods"
    SERVICE = "service"
    BUNDLE = "bundle"


class ProductStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    DISCONTINUED = "discontinued"


class WarehouseType(str, Enum):
    CENTRAL = "central"
    TRANSIT = "transit"
    RETAIL = "retail"
    QUARANTINE = "quarantine"


class MasterEntityType(str, Enum):
    EMPLOYEE = "employee"
    CUSTOMER = "customer"
    VENDOR = "vendor"
    PRODUCT = "product"
    PRODUCT_CATEGORY = "product_category"
    UOM = "uom"
    CURRENCY = "currency"
    TAX = "tax"
    ASSET = "asset"
    WAREHOUSE = "warehouse"


CODE_PREFIXES: dict[MasterEntityType, tuple[str, int]] = {
    MasterEntityType.EMPLOYEE: ("EMP-", 6),
    MasterEntityType.CUSTOMER: ("CUST-", 5),
    MasterEntityType.VENDOR: ("VEND-", 5),
    MasterEntityType.PRODUCT: ("PRD-", 5),
    MasterEntityType.PRODUCT_CATEGORY: ("CAT-", 5),
    MasterEntityType.TAX: ("TAX-", 5),
    MasterEntityType.ASSET: ("AST-", 6),
    MasterEntityType.WAREHOUSE: ("WH-", 6),
}

WORKFLOW_CODES: dict[str, str] = {
    "master_employee": "MDM_EMPLOYEE_CREATE",
    "master_customer": "MDM_CUSTOMER_CREATE",
    "master_product": "MDM_PRODUCT_CREATE",
}
