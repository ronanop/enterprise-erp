"""Quality Pydantic schemas."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    revision: str | None = None
    process_name: str | None = None
    notes: str | None = None


class InspectionPlanUpdateRequest(BaseModel):
    plan_name: str | None = None
    product_id: UUID | None = None
    product_category: str | None = None
    sampling_plan_id: UUID | None = None
    revision: str | None = None
    process_name: str | None = None
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
    revision: str | None = None
    process_name: str | None = None
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
    reaction_plan: str | None = None
    control_method: str | None = None
    sample_frequency: str | None = None


class CharacteristicUpdateRequest(BaseModel):
    characteristic_name: str | None = None
    target_value: Decimal | None = None
    min_value: Decimal | None = None
    max_value: Decimal | None = None
    is_mandatory: bool | None = None
    reaction_plan: str | None = None
    control_method: str | None = None
    sample_frequency: str | None = None
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
    reaction_plan: str | None = None
    control_method: str | None = None
    sample_frequency: str | None = None
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

    @field_validator("pass_fail", mode="before")
    @classmethod
    def normalize_pass_fail(cls, value: object) -> str | None:
        if value is None or (isinstance(value, str) and value.strip() == ""):
            return None
        normalized = str(value).strip().lower()
        if normalized not in {"pass", "fail", "na"}:
            raise ValueError("pass_fail must be pass, fail, or na")
        return normalized


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

    @field_validator("document_date", mode="before")
    @classmethod
    def default_document_date(cls, value: object) -> date | None:
        if value is None or (isinstance(value, str) and value.strip() == ""):
            return date.today()
        return value  # type: ignore[return-value]

    @field_validator("inspected_qty", "accepted_qty", "rejected_qty", mode="before")
    @classmethod
    def coerce_non_negative_qty(cls, value: object) -> Decimal:
        if value is None:
            return Decimal("0")
        qty = Decimal(str(value))
        if qty < 0:
            raise ValueError("Quantity cannot be negative")
        return qty

    @model_validator(mode="after")
    def validate_disposition(self) -> "IncomingInspectionCreateRequest":
        if self.accepted_qty + self.rejected_qty > self.inspected_qty:
            raise ValueError("Accepted plus rejected quantity cannot exceed inspected quantity")
        return self


class IncomingInspectionUpdateRequest(BaseModel):
    inspected_qty: Decimal | None = None
    accepted_qty: Decimal | None = None
    rejected_qty: Decimal | None = None
    inspector_employee_id: UUID | None = None
    version: int | None = None

    @field_validator("inspected_qty", "accepted_qty", "rejected_qty", mode="before")
    @classmethod
    def coerce_non_negative_qty(cls, value: object) -> Decimal | None:
        if value is None:
            return None
        qty = Decimal(str(value))
        if qty < 0:
            raise ValueError("Quantity cannot be negative")
        return qty


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
    vendor_id: UUID | None = None
    inspection_plan_id: UUID | None = None
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


class IncomingLinesAddRequest(BaseModel):
    lines: list[IncomingLineCreate] = Field(min_length=1)


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
    branch_id: UUID | None = None
    document_number: str
    document_date: date
    production_order_id: UUID
    product_id: UUID
    production_operation_id: UUID | None = None
    operation_seq: int | None = None
    inspector_employee_id: UUID | None = None
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

    @field_validator("quantity", mode="before")
    @classmethod
    def coerce_non_negative_qty(cls, value: object) -> Decimal:
        if value is None:
            return Decimal("0")
        qty = Decimal(str(value))
        if qty < 0:
            raise ValueError("Quantity cannot be negative")
        return qty

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"minor", "major", "critical"}:
            raise ValueError("severity must be minor, major, or critical")
        return normalized

    @field_validator("source_inspection_type")
    @classmethod
    def validate_source(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"incoming", "in_process", "final", "audit", "complaint", "other"}
        if normalized not in allowed:
            raise ValueError(f"source_inspection_type must be one of: {', '.join(sorted(allowed))}")
        return normalized


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
    description: str | None = None
    source_inspection_type: str
    incoming_inspection_id: UUID | None = None
    inprocess_inspection_id: UUID | None = None
    final_inspection_id: UUID | None = None
    product_id: UUID | None = None
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
    branch_id: UUID | None = None
    document_number: str
    document_date: date
    source: str
    severity: str
    status: str
    description: str | None
    product_id: UUID | None = None
    vendor_id: UUID | None = None
    customer_id: UUID | None = None
    incoming_inspection_id: UUID | None = None
    inprocess_inspection_id: UUID | None = None
    final_inspection_id: UUID | None = None
    workflow_status: str | None = None
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


class RootCauseResponse(OrmModel):
    id: UUID
    sequence_no: int
    method: str
    cause_text: str
    status: str


class CapaActionResponse(OrmModel):
    id: UUID
    sequence_no: int
    action_text: str
    owner_employee_id: UUID | None
    due_date: date | None
    status: str


class CapaResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID | None = None
    document_number: str
    document_date: date
    ncr_id: UUID
    capa_type: str
    status: str
    due_date: date | None
    verified_at: datetime | None
    notes: str | None = None
    owner_employee_id: UUID | None = None
    workflow_status: str | None = None
    root_causes: list[RootCauseResponse] = Field(default_factory=list)
    corrective_actions: list[CapaActionResponse] = Field(default_factory=list)
    preventive_actions: list[CapaActionResponse] = Field(default_factory=list)
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
    description: str | None = None
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


class PfmeaLineCreate(BaseModel):
    sequence_no: int | None = None
    process_step: str | None = None
    failure_mode: str | None = None
    failure_effect: str | None = None
    failure_cause: str | None = None
    severity: int
    occurrence: int
    detection: int
    characteristic_id: UUID | None = None
    recommended_action: str | None = None
    status: str = "open"


class PfmeaCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    pfmea_name: str
    inspection_plan_id: UUID
    product_id: UUID | None = None
    process_name: str | None = None
    revision: str | None = None
    notes: str | None = None
    lines: list[PfmeaLineCreate] = Field(default_factory=list)


class PfmeaUpdateRequest(BaseModel):
    pfmea_name: str | None = None
    process_name: str | None = None
    revision: str | None = None
    notes: str | None = None
    status: str | None = None
    lines: list[PfmeaLineCreate] | None = None
    version: int | None = None


class PfmeaLineResponse(OrmModel):
    id: UUID
    sequence_no: int
    process_step: str | None
    failure_mode: str | None
    failure_effect: str | None
    failure_cause: str | None
    severity: int
    occurrence: int
    detection: int
    rpn: int
    characteristic_id: UUID | None
    recommended_action: str | None
    status: str


class PfmeaResponse(OrmModel):
    id: UUID
    company_id: UUID
    pfmea_code: str
    pfmea_name: str
    inspection_plan_id: UUID
    product_id: UUID | None
    process_name: str | None
    revision: str | None
    status: str
    notes: str | None
    lines: list[PfmeaLineResponse] = Field(default_factory=list)
    version: int


class PpapCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    vendor_id: UUID
    product_id: UUID
    submission_level: str
    inspection_plan_id: UUID
    pfmea_id: UUID | None = None
    document_date: date | None = None
    notes: str | None = None

    @field_validator("submission_level")
    @classmethod
    def validate_level(cls, value: str) -> str:
        normalized = str(value).strip()
        if normalized not in {"1", "2", "3", "4", "5"}:
            raise ValueError("submission_level must be 1, 2, 3, 4, or 5")
        return normalized


class PpapUpdateRequest(BaseModel):
    notes: str | None = None
    pfmea_id: UUID | None = None
    submission_level: str | None = None
    version: int | None = None


class PpapResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    vendor_id: UUID
    product_id: UUID
    submission_level: str
    status: str
    inspection_plan_id: UUID
    pfmea_id: UUID | None
    workflow_status: str | None
    notes: str | None
    version: int


class SpcReadingCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    characteristic_id: UUID
    measured_value: Decimal
    product_id: UUID | None = None
    inspection_plan_id: UUID | None = None
    recorded_at: datetime | None = None
    source_inspection_type: str | None = None
    incoming_inspection_id: UUID | None = None
    inprocess_inspection_id: UUID | None = None
    final_inspection_id: UUID | None = None

    @field_validator("source_inspection_type")
    @classmethod
    def validate_source(cls, value: str | None) -> str | None:
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip().lower()
        allowed = {"incoming", "in_process", "final", "audit", "complaint", "other"}
        if normalized not in allowed:
            raise ValueError(f"source_inspection_type must be one of: {', '.join(sorted(allowed))}")
        return normalized


class SpcCapabilityResponse(BaseModel):
    characteristic_id: UUID
    sample_count: int
    mean: Decimal | None = None
    stdev: Decimal | None = None
    lsl: Decimal | None = None
    usl: Decimal | None = None
    target: Decimal | None = None
    cp: Decimal | None = None
    cpk: Decimal | None = None


class SpcReadingResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    characteristic_id: UUID
    product_id: UUID | None = None
    inspection_plan_id: UUID | None = None
    measured_value: Decimal
    recorded_at: datetime
    source_inspection_type: str | None = None
    incoming_inspection_id: UUID | None = None
    inprocess_inspection_id: UUID | None = None
    final_inspection_id: UUID | None = None
    is_out_of_control: bool
    ncr_id: UUID | None = None
    version: int
    capability: SpcCapabilityResponse | None = None


class ScarCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    vendor_id: UUID
    product_id: UUID | None = None
    ncr_id: UUID | None = None
    capa_id: UUID | None = None
    severity: str = "minor"
    description: str | None = None
    due_date: date | None = None
    document_date: date | None = None

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"minor", "major", "critical"}:
            raise ValueError("severity must be minor, major, or critical")
        return normalized


class ScarUpdateRequest(BaseModel):
    description: str | None = None
    severity: str | None = None
    due_date: date | None = None
    product_id: UUID | None = None
    ncr_id: UUID | None = None
    capa_id: UUID | None = None
    version: int | None = None


class ScarRecordResponseRequest(BaseModel):
    supplier_response: str

    @field_validator("supplier_response")
    @classmethod
    def validate_response(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("supplier_response is required")
        return text


class ScarResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    vendor_id: UUID
    product_id: UUID | None
    ncr_id: UUID | None
    capa_id: UUID | None
    severity: str
    description: str | None
    supplier_response: str | None
    due_date: date | None
    status: str
    workflow_status: str | None
    version: int


class VinTraceComponentCreate(BaseModel):
    line_number: int | None = None
    product_id: UUID
    batch_id: UUID | None = None
    quantity: Decimal = Decimal("0")
    source_module: str | None = None
    source_document_type: str | None = None
    source_document_id: UUID | None = None

    @field_validator("quantity", mode="before")
    @classmethod
    def coerce_qty(cls, value: object) -> Decimal:
        if value is None:
            return Decimal("0")
        qty = Decimal(str(value))
        if qty < 0:
            raise ValueError("Quantity cannot be negative")
        return qty


class VinTraceCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    vin: str
    product_id: UUID
    final_inspection_id: UUID | None = None
    production_order_id: UUID | None = None
    status: str | None = None
    document_date: date | None = None
    components: list[VinTraceComponentCreate] = Field(default_factory=list)

    @field_validator("vin")
    @classmethod
    def validate_vin(cls, value: str) -> str:
        vin = value.strip().upper()
        if len(vin) != 17:
            raise ValueError("VIN must be 17 characters")
        if any(ch in vin for ch in "IOQ"):
            raise ValueError("VIN cannot contain I, O, or Q")
        if not vin.isalnum():
            raise ValueError("VIN must be alphanumeric")
        return vin

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip().lower()
        if normalized not in {"built", "inspected", "shipped"}:
            raise ValueError("status must be built, inspected, or shipped")
        return normalized


class VinTraceUpdateRequest(BaseModel):
    final_inspection_id: UUID | None = None
    production_order_id: UUID | None = None
    status: str | None = None
    components: list[VinTraceComponentCreate] | None = None
    version: int | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip().lower()
        if normalized not in {"built", "inspected", "shipped"}:
            raise ValueError("status must be built, inspected, or shipped")
        return normalized


class VinTraceComponentResponse(OrmModel):
    id: UUID
    line_number: int
    product_id: UUID
    batch_id: UUID | None
    quantity: Decimal
    source_module: str | None
    source_document_type: str | None
    source_document_id: UUID | None


class VinTraceResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    vin: str
    product_id: UUID
    final_inspection_id: UUID | None
    production_order_id: UUID | None
    status: str
    version: int
    components: list[VinTraceComponentResponse] = Field(default_factory=list)


_WARRANTY_TYPES = {"field_failure", "part_replacement", "goodwill", "campaign", "other"}
_WARRANTY_STATUSES = {
    "draft",
    "investigating",
    "accepted",
    "rejected",
    "capa_linked",
    "closed",
    "cancelled",
}


class WarrantyClaimCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    vin_trace_id: UUID
    vin: str | None = None
    customer_id: UUID | None = None
    product_id: UUID | None = None
    component_product_id: UUID | None = None
    quantity: Decimal = Decimal("1")
    description: str | None = None
    claim_type: str = "field_failure"
    capa_id: UUID | None = None
    ncr_id: UUID | None = None
    customer_complaint_id: UUID | None = None
    document_date: date | None = None

    @field_validator("vin")
    @classmethod
    def validate_vin(cls, value: str | None) -> str | None:
        if value is None or str(value).strip() == "":
            return None
        vin = str(value).strip().upper()
        if len(vin) != 17:
            raise ValueError("VIN must be 17 characters")
        return vin

    @field_validator("claim_type")
    @classmethod
    def validate_claim_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in _WARRANTY_TYPES:
            raise ValueError("invalid claim_type")
        return normalized

    @field_validator("quantity", mode="before")
    @classmethod
    def coerce_qty(cls, value: object) -> Decimal:
        if value is None:
            return Decimal("1")
        qty = Decimal(str(value))
        if qty < 0:
            raise ValueError("Quantity cannot be negative")
        return qty


class WarrantyClaimUpdateRequest(BaseModel):
    vin: str | None = None
    customer_id: UUID | None = None
    product_id: UUID | None = None
    component_product_id: UUID | None = None
    quantity: Decimal | None = None
    description: str | None = None
    claim_type: str | None = None
    capa_id: UUID | None = None
    ncr_id: UUID | None = None
    customer_complaint_id: UUID | None = None
    status: str | None = None
    version: int | None = None

    @field_validator("claim_type")
    @classmethod
    def validate_claim_type(cls, value: str | None) -> str | None:
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip().lower()
        if normalized not in _WARRANTY_TYPES:
            raise ValueError("invalid claim_type")
        return normalized

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip().lower()
        if normalized not in _WARRANTY_STATUSES:
            raise ValueError("invalid status")
        return normalized


class WarrantyLinkCapaRequest(BaseModel):
    capa_id: UUID


class WarrantyClaimResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    vin_trace_id: UUID
    vin: str | None
    customer_id: UUID | None
    product_id: UUID
    component_product_id: UUID | None
    quantity: Decimal
    description: str | None
    claim_type: str
    capa_id: UUID | None
    ncr_id: UUID | None
    customer_complaint_id: UUID | None
    status: str
    version: int


def _normalize_vin(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    vin = str(value).strip().upper()
    if len(vin) != 17:
        raise ValueError("VIN must be 17 characters")
    if any(ch in vin for ch in "IOQ"):
        raise ValueError("VIN cannot contain I, O, or Q")
    if not vin.isalnum():
        raise ValueError("VIN must be alphanumeric")
    return vin


_RECALL_STATUSES = {"draft", "announced", "in_progress", "closed", "cancelled"}


class RecallCreateRequest(BaseModel):
    company_id: UUID
    branch_id: UUID
    product_id: UUID
    trigger_reason: str | None = None
    vin_from: str | None = None
    vin_to: str | None = None
    capa_id: UUID | None = None
    ncr_id: UUID | None = None
    warranty_claim_id: UUID | None = None
    document_date: date | None = None

    @field_validator("vin_from", "vin_to")
    @classmethod
    def validate_vin(cls, value: str | None) -> str | None:
        return _normalize_vin(value)

    @model_validator(mode="after")
    def validate_range(self):
        if (self.vin_from and not self.vin_to) or (self.vin_to and not self.vin_from):
            raise ValueError("vin_from and vin_to must be provided together")
        if self.vin_from and self.vin_to and self.vin_from > self.vin_to:
            raise ValueError("vin_from cannot be after vin_to")
        return self


class RecallUpdateRequest(BaseModel):
    product_id: UUID | None = None
    trigger_reason: str | None = None
    vin_from: str | None = None
    vin_to: str | None = None
    capa_id: UUID | None = None
    ncr_id: UUID | None = None
    warranty_claim_id: UUID | None = None
    status: str | None = None
    version: int | None = None

    @field_validator("vin_from", "vin_to")
    @classmethod
    def validate_vin(cls, value: str | None) -> str | None:
        return _normalize_vin(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip().lower()
        if normalized not in _RECALL_STATUSES:
            raise ValueError("invalid status")
        return normalized


class RecallResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    product_id: UUID
    trigger_reason: str | None
    vin_from: str | None
    vin_to: str | None
    status: str
    capa_id: UUID | None
    ncr_id: UUID | None
    warranty_claim_id: UUID | None
    version: int

