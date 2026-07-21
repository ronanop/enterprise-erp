"""Manufacturing Pydantic schemas."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BomLineCreate(BaseModel):
    line_number: int | None = None
    component_product_id: UUID
    quantity: Decimal
    uom_id: UUID
    scrap_percent: Decimal = Decimal("0")
    alternate_product_id: UUID | None = None
    is_optional: bool = False
    status: str = "active"


class BomCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    product_id: UUID
    revision: str = "A"
    effective_from: date
    effective_to: date | None = None
    notes: str | None = None
    lines: list[BomLineCreate] = Field(default_factory=list)


class BomUpdateRequest(BaseModel):
    revision: str | None = None
    effective_to: date | None = None
    notes: str | None = None
    version: int | None = None


class BomLineResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    bom_id: UUID
    line_number: int
    component_product_id: UUID
    quantity: Decimal
    uom_id: UUID
    scrap_percent: Decimal
    alternate_product_id: UUID | None
    is_optional: bool
    status: str
    company_id: UUID


class BomResponse(OrmModel):
    id: UUID
    company_id: UUID
    bom_number: str
    product_id: UUID
    revision: str
    effective_from: date
    effective_to: date | None
    status: str
    workflow_status: str | None
    notes: str | None
    lines: list[BomLineResponse] = Field(default_factory=list)


class RoutingOpCreate(BaseModel):
    operation_seq: int | None = None
    operation_code: str
    operation_name: str | None = None
    work_center_id: UUID
    setup_time_minutes: Decimal = Decimal("0")
    run_time_minutes: Decimal = Decimal("0")
    status: str = "active"


class RoutingCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    routing_name: str | None = None
    product_id: UUID | None = None
    notes: str | None = None
    operations: list[RoutingOpCreate] = Field(default_factory=list)


class RoutingUpdateRequest(BaseModel):
    routing_name: str | None = None
    notes: str | None = None
    version: int | None = None


class RoutingOpResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    routing_id: UUID
    operation_seq: int
    operation_code: str
    operation_name: str | None
    work_center_id: UUID
    setup_time_minutes: Decimal
    run_time_minutes: Decimal
    status: str
    company_id: UUID


class RoutingResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    routing_code: str
    routing_name: str | None
    product_id: UUID | None
    status: str
    notes: str | None
    company_id: UUID
    version: int


class WorkCenterCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    work_center_code: str
    work_center_name: str | None = None
    work_center_type: str = "machine"
    capacity_per_shift: Decimal | None = None
    shift_count: int = 1
    status: str = "active"


class WorkCenterUpdateRequest(BaseModel):
    work_center_name: str | None = None
    capacity_per_shift: Decimal | None = None
    shift_count: int | None = None
    status: str | None = None
    version: int | None = None


class WorkCenterResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    work_center_code: str
    work_center_name: str | None
    work_center_type: str
    capacity_per_shift: Decimal | None
    shift_count: int
    status: str
    company_id: UUID
    version: int


class MachineCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    machine_code: str
    machine_name: str | None = None
    work_center_id: UUID
    status: str = "idle"


class MachineUpdateRequest(BaseModel):
    machine_name: str | None = None
    status: str | None = None
    version: int | None = None


class MachineResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    machine_code: str
    machine_name: str | None
    work_center_id: UUID
    status: str
    last_status_at: datetime | None
    company_id: UUID
    version: int


class ProductionOrderCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    product_id: UUID
    bom_id: UUID
    warehouse_id: UUID
    planned_qty: Decimal
    uom_id: UUID
    document_date: date | None = None
    routing_id: UUID | None = None
    cost_center_id: UUID | None = None
    source_module: str | None = None
    source_document_id: UUID | None = None


class ProductionOrderUpdateRequest(BaseModel):
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    version: int | None = None


class ProductionOperationResponse(OrmModel):
    id: UUID
    production_order_id: UUID
    operation_seq: int
    routing_operation_id: UUID | None
    work_center_id: UUID | None
    machine_id: UUID | None
    operator_employee_id: UUID | None
    planned_qty: Decimal
    produced_qty: Decimal
    rejected_qty: Decimal
    setup_time_actual: Decimal | None
    run_time_actual: Decimal | None
    status: str
    company_id: UUID
    branch_id: UUID


class ProductionOrderResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    product_id: UUID
    bom_id: UUID
    routing_id: UUID | None
    warehouse_id: UUID
    planned_qty: Decimal
    completed_qty: Decimal
    scrapped_qty: Decimal
    uom_id: UUID
    status: str
    operations: list[ProductionOperationResponse] = Field(default_factory=list)


class OperationUpdateRequest(BaseModel):
    machine_id: UUID | None = None
    operator_employee_id: UUID | None = None
    produced_qty: Decimal | None = None
    rejected_qty: Decimal | None = None
    setup_time_actual: Decimal | None = None
    run_time_actual: Decimal | None = None
    status: str | None = None


class MaterialLineCreate(BaseModel):
    line_number: int | None = None
    component_product_id: UUID
    quantity: Decimal
    uom_id: UUID
    bom_line_id: UUID | None = None
    batch_reference: UUID | None = None
    bin_reference: UUID | None = None
    unit_cost: Decimal | None = None


class MaterialIssueCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    production_order_id: UUID
    warehouse_id: UUID
    document_date: date | None = None
    period_id: UUID | None = None
    lines: list[MaterialLineCreate]


class MaterialConfirmRequest(BaseModel):
    wip_account_id: UUID | None = None
    inventory_account_id: UUID | None = None
    fiscal_year_id: UUID | None = None


class MaterialIssueLineResponse(OrmModel):
    id: UUID
    material_issue_id: UUID
    line_number: int
    component_product_id: UUID
    quantity: Decimal
    uom_id: UUID
    bom_line_id: UUID | None
    batch_reference: UUID | None
    bin_reference: UUID | None
    unit_cost: Decimal | None
    inventory_event_id: UUID | None
    status: str
    company_id: UUID
    branch_id: UUID


class MaterialIssueResponse(OrmModel):
    id: UUID
    document_number: str
    document_date: date
    production_order_id: UUID
    warehouse_id: UUID
    status: str
    issued_at: datetime | None
    issued_by: UUID | None
    finance_journal_id: UUID | None
    period_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int


class MaterialReturnCreateRequest(MaterialIssueCreateRequest):
    pass


class MaterialReturnResponse(OrmModel):
    id: UUID
    document_number: str
    document_date: date
    production_order_id: UUID
    warehouse_id: UUID
    status: str
    returned_at: datetime | None = None
    returned_by: UUID | None = None
    finance_journal_id: UUID | None = None
    period_id: UUID | None = None
    company_id: UUID
    branch_id: UUID
    version: int


class ReceiptLineCreate(BaseModel):
    line_number: int | None = None
    product_id: UUID
    quantity: Decimal
    uom_id: UUID
    unit_cost: Decimal | None = None
    quality_status: str | None = None
    quality_reference: UUID | None = None


class ProductionReceiptCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    production_order_id: UUID
    warehouse_id: UUID
    document_date: date | None = None
    period_id: UUID | None = None
    lines: list[ReceiptLineCreate]


class ReceiptConfirmRequest(BaseModel):
    fg_account_id: UUID | None = None
    wip_account_id: UUID | None = None
    fiscal_year_id: UUID | None = None


class ReceiptLineResponse(OrmModel):
    id: UUID
    production_receipt_id: UUID
    line_number: int
    product_id: UUID
    quantity: Decimal
    uom_id: UUID
    unit_cost: Decimal | None
    quality_status: str | None
    quality_reference: UUID | None
    inventory_event_id: UUID | None
    status: str
    company_id: UUID
    branch_id: UUID


class ProductionReceiptResponse(OrmModel):
    id: UUID
    document_number: str
    document_date: date
    production_order_id: UUID
    warehouse_id: UUID
    status: str
    received_at: datetime | None
    received_by: UUID | None
    finance_journal_id: UUID | None
    period_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int


class ScrapCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    production_order_id: UUID
    scrap_type: str = "process"
    product_id: UUID
    quantity: Decimal
    uom_id: UUID
    reason_code: str | None = None
    unit_cost: Decimal | None = None
    document_date: date | None = None
    period_id: UUID | None = None


class ScrapPostRequest(BaseModel):
    scrap_expense_account_id: UUID
    wip_account_id: UUID
    fiscal_year_id: UUID | None = None


class ScrapResponse(OrmModel):
    id: UUID
    document_number: str
    document_date: date
    production_order_id: UUID
    scrap_type: str
    product_id: UUID
    quantity: Decimal
    status: str
    total_cost: Decimal | None


class WipResponse(OrmModel):
    id: UUID
    production_order_id: UUID
    material_cost: Decimal
    labor_cost: Decimal
    overhead_cost: Decimal
    total_cost: Decimal
    status: str
    period_id: UUID | None
    finance_journal_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int


class VariancePostRequest(BaseModel):
    variance_account_id: UUID
    wip_account_id: UUID
    fiscal_year_id: UUID | None = None


class VarianceResponse(OrmModel):
    id: UUID
    production_order_id: UUID
    variance_type: str
    standard_amount: Decimal
    actual_amount: Decimal
    variance_amount: Decimal
    status: str
    period_id: UUID | None
    finance_journal_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int


class ReportSummaryResponse(BaseModel):
    name: str
    row_count: int
    rows: list[dict[str, Any]]


class CloseOrderRequest(BaseModel):
    standard_material_cost: Decimal | None = None
