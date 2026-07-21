"""Inventory Pydantic schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BinCreateRequest(BaseModel):
    warehouse_id: UUID
    bin_code: str
    bin_name: str | None = None
    aisle: str | None = None
    rack: str | None = None
    shelf: str | None = None
    parent_bin_id: UUID | None = None
    bin_type: str = "storage"
    company_id: UUID | None = None
    branch_id: UUID | None = None


class BinUpdateRequest(BaseModel):
    bin_name: str | None = None
    aisle: str | None = None
    rack: str | None = None
    shelf: str | None = None
    bin_type: str | None = None
    status: str | None = None
    version: int | None = None


class BinResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    warehouse_id: UUID
    bin_code: str
    bin_name: str | None
    bin_type: str
    status: str
    version: int


class BatchCreateRequest(BaseModel):
    product_id: UUID
    batch_number: str | None = None
    manufacturing_date: date | None = None
    expiry_date: date | None = None
    barcode_value: str | None = None
    company_id: UUID | None = None
    branch_id: UUID | None = None


class BatchUpdateRequest(BaseModel):
    manufacturing_date: date | None = None
    expiry_date: date | None = None
    barcode_value: str | None = None
    status: str | None = None
    version: int | None = None


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    product_id: UUID
    batch_number: str
    status: str
    expiry_date: date | None
    version: int


class SerialCreateRequest(BaseModel):
    product_id: UUID
    serial_number: str | None = None
    batch_id: UUID | None = None
    warehouse_id: UUID | None = None
    bin_id: UUID | None = None
    barcode_value: str | None = None
    company_id: UUID | None = None
    branch_id: UUID | None = None


class SerialUpdateRequest(BaseModel):
    warehouse_id: UUID | None = None
    bin_id: UUID | None = None
    status: str | None = None
    version: int | None = None


class SerialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    product_id: UUID
    serial_number: str
    status: str
    version: int


class StockBalanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    warehouse_id: UUID
    product_id: UUID
    on_hand_qty: float
    reserved_qty: float
    available_qty: float
    quality_status: str
    status: str
    version: int


class LedgerEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    entry_number: str
    movement_type: str
    quantity_in: float
    quantity_out: float
    product_id: UUID
    warehouse_id: UUID
    posted_at: datetime
    source_module: str
    source_document_type: str
    source_document_id: UUID


class ReservationCreateRequest(BaseModel):
    warehouse_id: UUID
    product_id: UUID
    uom_id: UUID
    quantity: float = Field(gt=0)
    company_id: UUID | None = None
    branch_id: UUID | None = None
    bin_id: UUID | None = None
    batch_id: UUID | None = None
    source_module: str = "inventory"
    source_document_type: str = "manual"
    source_document_id: UUID
    source_line_id: UUID | None = None


class ReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    warehouse_id: UUID
    product_id: UUID
    quantity_reserved: float
    quantity_issued: float
    status: str
    version: int


class TransferLineRequest(BaseModel):
    line_number: int
    product_id: UUID
    quantity: float = Field(gt=0)
    uom_id: UUID
    from_bin_id: UUID | None = None
    to_bin_id: UUID | None = None
    batch_id: UUID | None = None


class TransferCreateRequest(BaseModel):
    document_date: date
    transfer_type: str = "warehouse"
    from_warehouse_id: UUID
    to_warehouse_id: UUID
    company_id: UUID | None = None
    branch_id: UUID | None = None
    lines: list[TransferLineRequest] = []


class TransferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    document_number: str
    document_date: date
    transfer_type: str
    from_warehouse_id: UUID
    to_warehouse_id: UUID
    status: str
    version: int


class AdjustmentLineRequest(BaseModel):
    line_number: int
    product_id: UUID
    quantity: float
    uom_id: UUID
    bin_id: UUID | None = None
    batch_id: UUID | None = None
    unit_cost: float | None = None


class AdjustmentCreateRequest(BaseModel):
    document_date: date
    warehouse_id: UUID
    reason_code: str
    company_id: UUID | None = None
    branch_id: UUID | None = None
    fiscal_year_id: UUID | None = None
    period_id: UUID | None = None
    lines: list[AdjustmentLineRequest] = []


class AdjustmentPostRequest(BaseModel):
    inventory_account_id: UUID | None = None
    offset_account_id: UUID | None = None


class AdjustmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    document_number: str
    document_date: date
    warehouse_id: UUID
    reason_code: str
    status: str
    version: int


class CycleCountLineRequest(BaseModel):
    line_number: int
    product_id: UUID
    system_qty: float = 0
    counted_qty: float = 0
    bin_id: UUID | None = None
    batch_id: UUID | None = None


class CycleCountCreateRequest(BaseModel):
    document_date: date
    count_type: str = "monthly"
    warehouse_id: UUID
    company_id: UUID | None = None
    branch_id: UUID | None = None
    lines: list[CycleCountLineRequest] = []


class CycleCountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    document_number: str
    document_date: date
    count_type: str
    warehouse_id: UUID
    status: str
    version: int


class ReorderPolicyCreateRequest(BaseModel):
    warehouse_id: UUID
    product_id: UUID
    reorder_point: float
    safety_stock: float | None = None
    reorder_qty: float | None = None
    company_id: UUID | None = None
    branch_id: UUID | None = None


class ReorderPolicyUpdateRequest(BaseModel):
    reorder_point: float | None = None
    safety_stock: float | None = None
    reorder_qty: float | None = None
    status: str | None = None
    version: int | None = None


class ReorderPolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    warehouse_id: UUID
    product_id: UUID
    reorder_point: float
    status: str
    version: int


class ValuationLayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    warehouse_id: UUID
    product_id: UUID
    original_qty: float
    remaining_qty: float
    unit_cost: float
    currency_code: str
    source_module: str
    received_at: datetime | None = None
    status: str


class ValuationRunResponse(BaseModel):
    layer_count: int
    total_value: float


class ReportSummaryResponse(BaseModel):
    name: str
    row_count: int
    rows: list[dict]
