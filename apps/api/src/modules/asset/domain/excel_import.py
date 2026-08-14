"""Excel import domain types (CR-004 Phase 8B). Pure data — no ORM."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum
from uuid import UUID

DEFAULT_IMPORT_BATCH_SIZE = 50
MAX_IMPORT_BATCH_SIZE = 500

VALID_IMPORT_OPERATIONAL_STATUSES = frozenset(
    {
        "READY_TO_MOVE",
        "ASSIGNED",
        "RETIRED",
        "PENDING_DISPOSAL",
    }
)


class ExcelImportRowOutcome(str, Enum):
    IMPORTED = "imported"
    SKIPPED = "skipped"
    DUPLICATE = "duplicate"
    FAILED = "failed"


class ExcelImportSkipReason(str, Enum):
    INVALID_PREVIEW = "invalid_preview"
    WARNING_NOT_CONFIRMED = "warning_not_confirmed"
    DUPLICATE_ASSET_TAG = "duplicate_asset_tag"
    DUPLICATE_SERIAL = "duplicate_serial"
    BATCH_ROLLED_BACK = "batch_rolled_back"


@dataclass(frozen=True)
class ExcelImportDefaults:
    asset_category_id: UUID
    asset_type: str = "fixed"
    purchase_date: date | None = None
    purchase_cost: Decimal = Decimal("0")
    currency_code: str = "USD"


@dataclass(frozen=True)
class ExcelImportRowInput:
    row_number: int
    preview_status: str
    asset_tag: str
    asset_name: str
    branch_id: UUID
    operational_status: str
    employee_id: UUID | None = None
    department_id: UUID | None = None
    asset_category_id: UUID | None = None
    serial_number: str | None = None
    make: str | None = None
    model: str | None = None
    configuration: str | None = None
    location_label: str | None = None
    issue_date: date | None = None
    delivery_reference_number: str | None = None
    delivery_reference_status: str | None = None
    delivery_challan_signature_status: str | None = None
    assignment_remarks: str | None = None
    company_id: UUID | None = None


@dataclass
class ExcelImportRowResult:
    row_number: int
    outcome: str
    reason: str | None = None
    asset_id: UUID | None = None
    assignment_id: UUID | None = None
    operational_status: str | None = None
    warning: bool = False


@dataclass
class ExcelImportSummary:
    total_rows: int = 0
    imported: int = 0
    skipped: int = 0
    duplicates: int = 0
    warnings: int = 0
    failed: int = 0
    duration_ms: int = 0
    batch_count: int = 0
    rows: list[ExcelImportRowResult] = field(default_factory=list)
