"""Asset Pydantic schemas."""

from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AssetCategoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AssetCategoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetCategoryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    category_code: str
    category_name: str
    default_useful_life_months: int | None
    default_depreciation_method: str | None
    gl_asset_account_id: UUID | None
    gl_accum_depr_account_id: UUID | None
    gl_expense_account_id: UUID | None
    status: str
    company_id: UUID
    version: int

class AssetCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AssetUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetResponse(OrmModel):
    id: UUID
    document_number: str
    asset_code: str
    asset_name: str
    asset_category_id: UUID
    asset_type: str
    master_asset_id: UUID | None
    product_id: UUID | None
    supplier_vendor_id: UUID | None
    serial_number: str | None
    barcode: str | None
    qr_code: str | None
    rfid_tag: str | None
    purchase_date: date | None
    purchase_cost: Decimal | None
    current_book_value: Decimal | None
    salvage_value: Decimal | None
    currency_code: str
    depreciation_method: str | None
    useful_life_months: int | None
    department_id: UUID | None
    custodian_employee_id: UUID | None
    purchase_order_id: UUID | None
    grn_id: UUID | None
    inventory_receipt_id: UUID | None
    inventory_issue_id: UUID | None
    project_id: UUID | None
    production_order_id: UUID | None
    quality_inspection_id: UUID | None
    is_shared: bool
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class AssetComponentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AssetComponentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetComponentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    component_code: str
    component_name: str
    product_id: UUID | None
    serial_number: str | None
    quantity: Decimal | None
    status: str
    company_id: UUID
    version: int

class AssetAssignmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AssetAssignmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetAssignmentResponse(OrmModel):
    id: UUID
    document_number: str
    asset_id: UUID
    allocation_type: str
    employee_id: UUID | None
    department_id: UUID | None
    project_id: UUID | None
    allocated_at: datetime | None
    expected_return_at: date | None
    returned_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class AssetTransferCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AssetTransferUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetTransferResponse(OrmModel):
    id: UUID
    document_number: str
    asset_id: UUID
    from_branch_id: UUID | None
    to_branch_id: UUID | None
    from_department_id: UUID | None
    to_department_id: UUID | None
    from_employee_id: UUID | None
    to_employee_id: UUID | None
    transferred_at: datetime | None
    reason: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class AssetLocationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AssetLocationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetLocationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    location_label: str
    org_location_id: UUID | None
    effective_from: datetime | None
    effective_to: datetime | None
    is_current: bool
    status: str
    company_id: UUID
    version: int

class AssetWarrantyCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AssetWarrantyUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetWarrantyResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    vendor_id: UUID | None
    warranty_type: str
    start_date: date
    end_date: date
    coverage_notes: str | None
    status: str
    company_id: UUID
    version: int

class AssetInsuranceCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AssetInsuranceUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetInsuranceResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    policy_number: str
    insurer_name: str
    vendor_id: UUID | None
    coverage_amount: Decimal | None
    start_date: date
    end_date: date
    status: str
    company_id: UUID
    version: int

class MaintenancePlanCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MaintenancePlanUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MaintenancePlanResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    document_number: str
    asset_id: UUID
    plan_name: str
    maintenance_type: str
    frequency_days: int | None
    frequency_meter_units: Decimal | None
    next_due_date: date | None
    status: str
    company_id: UUID
    version: int

class AssetMaintenanceCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AssetMaintenanceUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetMaintenanceResponse(OrmModel):
    id: UUID
    document_number: str
    asset_id: UUID
    maintenance_plan_id: UUID | None
    maintenance_type: str
    scheduled_date: date | None
    completed_date: date | None
    vendor_id: UUID | None
    cost_amount: Decimal | None
    technician_employee_id: UUID | None
    quality_inspection_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class ServiceHistoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceHistoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceHistoryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    maintenance_id: UUID
    service_summary: str
    parts_replaced_json: dict | None
    cost_amount: Decimal | None
    serviced_at: datetime | None
    status: str
    company_id: UUID
    version: int

class AssetDepreciationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AssetDepreciationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetDepreciationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    document_number: str
    asset_id: UUID
    period_year: int
    period_month: int
    method: str
    depreciation_amount: Decimal | None
    book_value_after: Decimal | None
    units_produced: Decimal | None
    depreciation_batch_id: UUID | None
    finance_journal_id: UUID | None
    idempotency_key: str
    status: str
    company_id: UUID
    version: int

class AssetDisposalCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AssetDisposalUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetDisposalResponse(OrmModel):
    id: UUID
    document_number: str
    asset_id: UUID
    disposal_type: str
    disposal_date: date | None
    proceeds_amount: Decimal | None
    book_value_at_disposal: Decimal | None
    finance_journal_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class AssetRevaluationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AssetRevaluationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetRevaluationResponse(OrmModel):
    id: UUID
    document_number: str
    asset_id: UUID
    revaluation_date: date | None
    old_book_value: Decimal | None
    new_book_value: Decimal | None
    reason: str | None
    finance_journal_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class AssetAuditCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AssetAuditUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetAuditResponse(OrmModel):
    id: UUID
    document_number: str
    asset_id: UUID | None
    audit_date: date | None
    auditor_employee_id: UUID
    found_status: str | None
    notes: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class AssetDocumentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AssetDocumentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetDocumentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    document_type: str
    document_name: str
    storage_uri: str | None
    content_hash: str | None
    status: str
    company_id: UUID
    version: int

class AssetChecklistCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AssetChecklistUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetChecklistResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID | None
    maintenance_id: UUID | None
    audit_id: UUID | None
    checklist_code: str
    checklist_name: str
    items_json: dict | None
    completed_at: datetime | None
    status: str
    company_id: UUID
    version: int

class MeterReadingCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MeterReadingUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MeterReadingResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    meter_type: str
    reading_value: Decimal
    reading_at: datetime
    recorded_by_employee_id: UUID | None
    status: str
    company_id: UUID
    version: int

class AssetNotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AssetNotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetNotificationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    notification_type: str
    recipient_user_id: UUID | None
    recipient_employee_id: UUID | None
    payload_json: dict | None
    sent_at: datetime | None
    delivery_status: str
    status: str
    company_id: UUID
    version: int

class AssetReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AssetReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AssetReportResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    report_code: str
    report_type: str
    period_start: date | None
    period_end: date | None
    department_id: UUID | None
    category_id: UUID | None
    metrics_json: dict | None
    generated_at: datetime | None
    status: str
    company_id: UUID
    version: int

class FinancePostRequest(BaseModel):
    debit_account_id: UUID
    credit_account_id: UUID
    fiscal_year_id: UUID | None = None
