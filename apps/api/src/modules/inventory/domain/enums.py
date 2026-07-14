"""Inventory domain enums."""

from enum import Enum


class MovementType(str, Enum):
    RECEIPT = "receipt"
    ISSUE = "issue"
    TRANSFER_OUT = "transfer_out"
    TRANSFER_IN = "transfer_in"
    ADJUSTMENT_IN = "adjustment_in"
    ADJUSTMENT_OUT = "adjustment_out"
    RETURN_IN = "return_in"
    RETURN_OUT = "return_out"
    COUNT_GAIN = "count_gain"
    COUNT_LOSS = "count_loss"


class BinType(str, Enum):
    STORAGE = "storage"
    QUARANTINE = "quarantine"
    STAGING = "staging"
    IN_TRANSIT = "in_transit"


class BinStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BLOCKED = "blocked"


class BatchStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    QUARANTINED = "quarantined"
    CLOSED = "closed"


class SerialStatus(str, Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    ISSUED = "issued"
    RETURNED = "returned"
    SCRAPPED = "scrapped"


class QualityStatus(str, Enum):
    AVAILABLE = "available"
    QUARANTINE = "quarantine"
    REJECTED = "rejected"


class BalanceStatus(str, Enum):
    ACTIVE = "active"
    BLOCKED = "blocked"


class ReservationStatus(str, Enum):
    ACTIVE = "active"
    PARTIALLY_ISSUED = "partially_issued"
    FULFILLED = "fulfilled"
    RELEASED = "released"
    CANCELLED = "cancelled"


class TransferStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    IN_TRANSIT = "in_transit"
    RECEIVED = "received"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class TransferType(str, Enum):
    WAREHOUSE = "warehouse"
    BIN = "bin"
    BRANCH = "branch"


class AdjustmentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    POSTED = "posted"
    CANCELLED = "cancelled"


class AdjustmentReason(str, Enum):
    DAMAGE = "damage"
    LOSS = "loss"
    SHRINKAGE = "shrinkage"
    COUNT_ERROR = "count_error"
    EXPIRY = "expiry"
    OTHER = "other"


class CycleCountStatus(str, Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    POSTED = "posted"
    CANCELLED = "cancelled"


class CycleCountType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    ANNUAL = "annual"


class VarianceType(str, Enum):
    MATCH = "match"
    SHORTAGE = "shortage"
    EXCESS = "excess"


class ValuationLayerStatus(str, Enum):
    OPEN = "open"
    DEPLETED = "depleted"
    REVERSED = "reversed"


class ReorderPolicyStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class InvEntityType(str, Enum):
    LEDGER = "ledger"
    TRANSFER = "transfer"
    ADJUSTMENT = "adjustment"
    CYCLE_COUNT = "cycle_count"
    BATCH = "batch"
    SERIAL = "serial"


CODE_PREFIXES: dict[InvEntityType, tuple[str, int]] = {
    InvEntityType.LEDGER: ("ILE-", 6),
    InvEntityType.TRANSFER: ("TRF-", 6),
    InvEntityType.ADJUSTMENT: ("ADJ-", 6),
    InvEntityType.CYCLE_COUNT: ("CNT-", 6),
    InvEntityType.BATCH: ("BATCH-", 6),
    InvEntityType.SERIAL: ("SN-", 6),
}


class SourceModule(str, Enum):
    PROCUREMENT = "procurement"
    SALES = "sales"
    INVENTORY = "inventory"
    MANUFACTURING = "manufacturing"
    QUALITY = "quality"
