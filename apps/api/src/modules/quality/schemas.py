"""Quality Pydantic schemas."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SamplingPlanCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    sampling_code: str | None = None
    sampling_name: str | None = None
    lot_size_from: Decimal | None = None
    lot_size_to: Decimal | None = None
    sample_size: Decimal
    accept_count: int = 0
    reject_count: int
    aql_percent: Decimal | None = None
    status: str = "active"


class SamplingPlanUpdateRequest(BaseModel):
    sampling_name: str | None = None
    lot_size_from: Decimal | None = None
    lot_size_to: Decimal | None = None
    sample_size: Decimal | None = None
    accept_count: int | None = None
    reject_count: int | None = None
    aql_percent: Decimal | None = None
    status: str | None = None
    version: int | None = None


class SamplingPlanResponse(OrmModel):
    id: UUID
    company_id: UUID
    sampling_code: str
    sampling_name: str | None
    sample_size: Decimal
    accept_count: int
    reject_count: int
    status: str
    version: int


class InspectionPlanCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    plan_name: str
    product_id: UUID | None = None
    product_category: str | None = None
    inspection_type: str
    sampling_plan_id: UUID | None = None
    notes: str | None = None


class InspectionPlanUpdateRequest(BaseModel):
    plan_name: str | None = None
    product_id: UUID | None = None
    product_category: str | None = None
    sampling_plan_id: UUID | None = None
    notes: str | None = None
    version: int | None = None


class InspectionPlanResponse(OrmModel):
    id: UUID
    company_id: UUID
    plan_code: str
    plan_name: str
    inspection_type: str
    product_id: UUID | None
    sampling_plan_id: UUID | None
    status: str
    notes: str | None
    version: int


class CharacteristicCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    inspection_plan_id: UUID | None = None
    characteristic_code: str | None = None
    characteristic_name: str
    characteristic_type: str = "numeric"
    uom_id: UUID | None = None
    target_value: Decimal | None = None
    min_value: Decimal | None = None
    max_value: Decimal | None = None
    is_mandatory: bool = True


class CharacteristicUpdateRequest(BaseModel):
    characteristic_name: str | None = None
    target_value: Decimal | None = None
    min_value: Decimal | None = None
    max_value: Decimal | None = None
    is_mandatory: bool | None = None
    status: str | None = None
    version: int | None = None


class CharacteristicResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    inspection_plan_id: UUID | None
    characteristic_code: str
    characteristic_name: str
    characteristic_type: str
    uom_id: UUID | None
    target_value: Decimal | None
    min_value: Decimal | None
    max_value: Decimal | None
    is_mandatory: bool
    status: str
    company_id: UUID
    version: int


class DefectTypeCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    defect_type_code: str | None = None
    defect_type_name: str
    severity_default: str = "minor"
    category: str = "other"


class DefectTypeUpdateRequest(BaseModel):
    defect_type_name: str | None = None
    severity_default: str | None = None
    category: str | None = None
    status: str | None = None
    version: int | None = None


class DefectTypeResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    defect_type_code: str
    defect_type_name: str
    severity_default: str
    category: str
    status: str
    company_id: UUID
    version: int


class IncomingLineCreate(BaseModel):
    line_number: int | None = None
    characteristic_id: UUID
    measured_value: Decimal | None = None
    measured_text: str | None = None
    pass_fail: str | None = None
    is_out_of_spec: bool = False
    defect_type_id: UUID | None = None
    notes: str | None = None


class IncomingInspectionCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    warehouse_id: UUID
    product_id: UUID
    uom_id: UUID
    document_date: date | None = None
    inspection_plan_id: UUID | None = None
    vendor_id: UUID | None = None
    inspected_qty: Decimal = Decimal("0")
    accepted_qty: Decimal = Decimal("0")
    rejected_qty: Decimal = Decimal("0")
    inspector_employee_id: UUID | None = None
    period_id: UUID | None = None
    lines: list[IncomingLineCreate] = Field(default_factory=list)


class IncomingInspectionUpdateRequest(BaseModel):
    inspected_qty: Decimal | None = None
    accepted_qty: Decimal | None = None
    rejected_qty: Decimal | None = None
    inspector_employee_id: UUID | None = None
    version: int | None = None


class IncomingLineResponse(OrmModel):
    id: UUID
    line_number: int
    characteristic_id: UUID
    measured_value: Decimal | None
    pass_fail: str | None
    is_out_of_spec: bool
    status: str


class IncomingInspectionResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    warehouse_id: UUID
    product_id: UUID
    uom_id: UUID
    inspected_qty: Decimal
    accepted_qty: Decimal
    rejected_qty: Decimal
    result: str
    status: str
    lines: list[IncomingLineResponse] = Field(default_factory=list)
    version: int


class IncomingApproveRequest(BaseModel):
    quality_expense_account_id: UUID | None = None
    inventory_account_id: UUID | None = None
    amount: Decimal | None = None
    fiscal_year_id: UUID | None = None


class InprocessInspectionCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    production_order_id: UUID
    product_id: UUID
    document_date: date | None = None
    production_operation_id: UUID | None = None
    operation_seq: int | None = None
    inspection_plan_id: UUID | None = None
    inspector_employee_id: UUID | None = None
    result: str = "pending"


class InprocessInspectionUpdateRequest(BaseModel):
    result: str | None = None
    inspector_employee_id: UUID | None = None
    version: int | None = None


class InprocessInspectionResponse(OrmModel):
    id: UUID
    company_id: UUID
    document_number: str
    document_date: date
    production_order_id: UUID
    product_id: UUID
    result: str
    status: str
    version: int


class FinalInspectionCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    production_order_id: UUID
    product_id: UUID
    warehouse_id: UUID
    uom_id: UUID
    inspected_qty: Decimal = Decimal("0")
    document_date: date | None = None
    production_receipt_id: UUID | None = None
    inspection_plan_id: UUID | None = None
    inspector_employee_id: UUID | None = None
    result: str = "pending"
    period_id: UUID | None = None


class FinalInspectionUpdateRequest(BaseModel):
    inspected_qty: Decimal | None = None
    result: str | None = None
    inspector_employee_id: UUID | None = None
    version: int | None = None


class FinalInspectionResponse(OrmModel):
    id: UUID
    company_id: UUID
    document_number: str
    document_date: date
    production_order_id: UUID
    product_id: UUID
    warehouse_id: UUID
    inspected_qty: Decimal
    result: str
    status: str
    version: int


class FinalCompleteRequest(BaseModel):
    scrap_expense_account_id: UUID | None = None
    inventory_account_id: UUID | None = None
    amount: Decimal | None = None
    fiscal_year_id: UUID | None = None


class DefectCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    defect_type_id: UUID
    severity: str = "minor"
    quantity: Decimal = Decimal("0")
    description: str | None = None
    source_inspection_type: str = "other"
    product_id: UUID | None = None
    incoming_inspection_id: UUID | None = None
    inprocess_inspection_id: UUID | None = None
    final_inspection_id: UUID | None = None


class DefectUpdateRequest(BaseModel):
    severity: str | None = None
    quantity: Decimal | None = None
    description: str | None = None
    version: int | None = None


class DefectResponse(OrmModel):
    id: UUID
    company_id: UUID
    document_number: str | None
    defect_type_id: UUID
    severity: str
    quantity: Decimal
    status: str
    ncr_id: UUID | None
    version: int


class DefectLinkNcrRequest(BaseModel):
    ncr_id: UUID


class NcrCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    source: str = "other"
    severity: str = "minor"
    description: str | None = None
    product_id: UUID | None = None
    vendor_id: UUID | None = None
    customer_id: UUID | None = None
    document_date: date | None = None
    incoming_inspection_id: UUID | None = None
    inprocess_inspection_id: UUID | None = None
    final_inspection_id: UUID | None = None


class NcrUpdateRequest(BaseModel):
    description: str | None = None
    severity: str | None = None
    version: int | None = None


class NcrResponse(OrmModel):
    id: UUID
    company_id: UUID
    document_number: str
    document_date: date
    source: str
    severity: str
    status: str
    description: str | None
    version: int


class CapaActionCreate(BaseModel):
    sequence_no: int | None = None
    action_text: str
    owner_employee_id: UUID | None = None
    due_date: date | None = None
    status: str = "open"


class RootCauseCreate(BaseModel):
    sequence_no: int | None = None
    method: str = "5_why"
    cause_text: str
    status: str = "open"


class CapaCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    ncr_id: UUID
    capa_type: str = "corrective"
    document_date: date | None = None
    owner_employee_id: UUID | None = None
    due_date: date | None = None
    notes: str | None = None
    root_causes: list[RootCauseCreate] = Field(default_factory=list)
    corrective_actions: list[CapaActionCreate] = Field(default_factory=list)
    preventive_actions: list[CapaActionCreate] = Field(default_factory=list)


class CapaUpdateRequest(BaseModel):
    notes: str | None = None
    due_date: date | None = None
    owner_employee_id: UUID | None = None
    version: int | None = None


class CapaChildResponse(OrmModel):
    id: UUID
    sequence_no: int
    status: str


class CapaResponse(OrmModel):
    id: UUID
    company_id: UUID
    document_number: str
    document_date: date
    ncr_id: UUID
    capa_type: str
    status: str
    due_date: date | None
    verified_at: datetime | None
    version: int


class SupplierQualityCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    vendor_id: UUID
    score_period_start: date
    score_period_end: date
    incoming_accept_rate: Decimal | None = None
    defect_rate: Decimal | None = None
    ncr_count: Decimal | None = None
    overall_score: Decimal | None = None


class SupplierQualityUpdateRequest(BaseModel):
    incoming_accept_rate: Decimal | None = None
    defect_rate: Decimal | None = None
    ncr_count: Decimal | None = None
    overall_score: Decimal | None = None
    version: int | None = None


class SupplierQualityResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    vendor_id: UUID
    score_period_start: date
    score_period_end: date
    incoming_accept_rate: Decimal | None
    defect_rate: Decimal | None
    ncr_count: Decimal | None
    overall_score: Decimal | None
    status: str
    company_id: UUID
    version: int


class CustomerComplaintCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    customer_id: UUID
    complaint_type: str = "other"
    product_id: UUID | None = None
    quantity: Decimal = Decimal("0")
    description: str | None = None
    document_date: date | None = None
    period_id: UUID | None = None


class CustomerComplaintUpdateRequest(BaseModel):
    complaint_type: str | None = None
    quantity: Decimal | None = None
    description: str | None = None
    ncr_id: UUID | None = None
    version: int | None = None


class CustomerComplaintResponse(OrmModel):
    id: UUID
    company_id: UUID
    document_number: str
    document_date: date
    customer_id: UUID
    complaint_type: str
    quantity: Decimal
    status: str
    ncr_id: UUID | None
    version: int


class QualityAuditCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    audit_type: str = "internal"
    audit_standard: str | None = None
    vendor_id: UUID | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    document_date: date | None = None
    lead_auditor_employee_id: UUID | None = None


class QualityAuditUpdateRequest(BaseModel):
    audit_standard: str | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    lead_auditor_employee_id: UUID | None = None
    version: int | None = None


class QualityAuditResponse(OrmModel):
    id: UUID
    company_id: UUID
    document_number: str
    document_date: date
    audit_type: str
    status: str
    planned_start: date | None
    planned_end: date | None
    actual_start: datetime | None
    actual_end: datetime | None
    version: int


class QualityScoreCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    score_code: str | None = None
    score_dimension: str = "company"
    dimension_ref_id: UUID | None = None
    period_start: date
    period_end: date


class QualityScoreUpdateRequest(BaseModel):
    score_code: str | None = None
    dimension_ref_id: UUID | None = None
    period_start: date | None = None
    period_end: date | None = None
    version: int | None = None


class QualityScorePublishRequest(BaseModel):
    inspected: int = 0
    passed: int = 0
    defects: int = 0
    rework: int = 0
    complaints: int = 0
    supplier_scores: Decimal = Decimal("0")
    supplier_count: int = 1


class QualityScoreResponse(OrmModel):
    id: UUID
    company_id: UUID
    score_dimension: str
    period_start: date
    period_end: date
    first_pass_yield: Decimal | None
    defect_rate: Decimal | None
    rework_rate: Decimal | None
    complaint_rate: Decimal | None
    supplier_quality_score: Decimal | None
    status: str
    version: int


class ReportSummaryResponse(BaseModel):
    name: str
    row_count: int
    rows: list[dict]
