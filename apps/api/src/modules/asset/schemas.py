"""Asset Pydantic schemas."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AssetCategoryCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    category_code: str
    category_name: str
    default_useful_life_months: int | None = None
    default_depreciation_method: str | None = None
    gl_asset_account_id: UUID | None = None
    gl_accum_depr_account_id: UUID | None = None
    gl_expense_account_id: UUID | None = None
    status: str | None = None
    asset_domain: str | None = "IT"


class AssetCategoryUpdate(BaseModel):
    category_name: str | None = None
    default_useful_life_months: int | None = None
    default_depreciation_method: str | None = None
    gl_asset_account_id: UUID | None = None
    gl_accum_depr_account_id: UUID | None = None
    gl_expense_account_id: UUID | None = None
    branch_id: UUID | None = None
    asset_domain: str | None = None
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
    asset_domain: str | None = None
    company_id: UUID
    version: int


class AssetCategoryListResult(BaseModel):
    items: list[AssetCategoryResponse]
    total: int
    page: int
    page_size: int


class AssetCreate(BaseModel):
    """Alias for asset registration create (FP-ASSET-REG-001)."""

    company_id: UUID | None = None
    branch_id: UUID
    asset_name: str
    asset_category_id: UUID
    asset_type_id: UUID
    # Legacy enum — optional; server defaults to "fixed" when omitted.
    asset_type: str | None = None
    asset_domain: str = "IT"
    purchase_date: date
    purchase_cost: Decimal
    currency_code: str = "USD"
    product_id: UUID | None = None
    supplier_vendor_id: UUID | None = None
    serial_number: str | None = None
    barcode: str | None = None
    qr_code: str | None = None
    rfid_tag: str | None = None
    make: str | None = None
    model: str | None = None
    configuration: str | None = None
    current_book_value: Decimal | None = None
    salvage_value: Decimal | None = None
    depreciation_method: str | None = None
    useful_life_months: int | None = None
    department_id: UUID | None = None
    custodian_employee_id: UUID | None = None
    purchase_order_id: UUID | None = None
    grn_id: UUID | None = None
    inventory_receipt_id: UUID | None = None
    inventory_issue_id: UUID | None = None
    project_id: UUID | None = None
    production_order_id: UUID | None = None
    quality_inspection_id: UUID | None = None
    is_shared: bool = False
    incoming_unit_id: UUID | None = None
    incoming_line_id: UUID | None = None
    location_label: str | None = None
    location_id: UUID | None = None
    building_id: UUID | None = None


AssetRegistrationCreate = AssetCreate


class AssetUpdate(BaseModel):
    asset_name: str | None = None
    asset_category_id: UUID | None = None
    asset_type_id: UUID | None = None
    asset_type: str | None = None
    asset_domain: str | None = None
    purchase_date: date | None = None
    purchase_cost: Decimal | None = None
    currency_code: str | None = None
    product_id: UUID | None = None
    supplier_vendor_id: UUID | None = None
    serial_number: str | None = None
    barcode: str | None = None
    qr_code: str | None = None
    rfid_tag: str | None = None
    make: str | None = None
    model: str | None = None
    configuration: str | None = None
    current_book_value: Decimal | None = None
    salvage_value: Decimal | None = None
    depreciation_method: str | None = None
    useful_life_months: int | None = None
    department_id: UUID | None = None
    custodian_employee_id: UUID | None = None
    purchase_order_id: UUID | None = None
    grn_id: UUID | None = None
    inventory_receipt_id: UUID | None = None
    inventory_issue_id: UUID | None = None
    project_id: UUID | None = None
    production_order_id: UUID | None = None
    quality_inspection_id: UUID | None = None
    is_shared: bool | None = None
    location_label: str | None = None
    version: int | None = None


AssetRegistrationUpdate = AssetUpdate


class GrnPrefillResponse(BaseModel):
    grn_id: UUID
    company_id: UUID
    branch_id: UUID
    vendor_id: UUID
    purchase_order_id: UUID
    currency_code: str
    lines: list[dict]


class AssetListResult(BaseModel):
    items: list["AssetResponse"]
    total: int
    page: int
    page_size: int


class AssetDashboardBranchSummary(BaseModel):
    branch_id: UUID
    total_assets: int
    ready_to_move: int
    assigned: int
    retired: int
    pending_disposal: int
    disposed: int
    in_use_as_component: int = 0


class AssetDashboardLocationSummary(BaseModel):
    location_id: UUID
    label: str
    total_assets: int
    ready_to_move: int
    assigned: int
    retired: int
    pending_disposal: int
    disposed: int
    in_use_as_component: int = 0


class AssetDashboardSummaryResponse(BaseModel):
    company_id: UUID
    branch_id: UUID | None = None
    location_id: UUID | None = None
    total_assets: int
    ready_to_move: int
    assigned: int
    retired: int
    pending_disposal: int
    disposed: int
    in_use_as_component: int = 0
    by_branch: list[AssetDashboardBranchSummary] = []
    by_location: list[AssetDashboardLocationSummary] = []


class AssetResponse(OrmModel):
    id: UUID
    document_number: str
    asset_code: str
    asset_name: str
    asset_category_id: UUID
    asset_type: str
    asset_type_id: UUID | None = None
    asset_type_name: str | None = None
    asset_domain: str = "IT"
    master_asset_id: UUID | None
    product_id: UUID | None
    supplier_vendor_id: UUID | None
    serial_number: str | None
    barcode: str | None
    qr_code: str | None
    rfid_tag: str | None
    make: str | None = None
    model: str | None = None
    configuration: str | None = None
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
    operational_status: str | None = None
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int
    discovery_profile_json: dict | None = None
    current_location_label: str | None = None


class AssetPortalAssignmentSummary(BaseModel):
    document_number: str | None = None
    allocation_type: str | None = None
    status: str | None = None
    assignee_label: str | None = None


class AssetPortalWarrantySummary(BaseModel):
    warranty_type: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class AssetPortalInsuranceSummary(BaseModel):
    policy_number: str | None = None
    insurer_name: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class AssetInformationPortalResponse(BaseModel):
    """Redacted asset profile for Information Portal / Self-Service (CR-002).

    Intentionally omits purchase cost, book value, depreciation, workflow,
    finance refs, and other internal fields.
    """

    asset_id: UUID
    asset_code: str
    asset_name: str
    category_code: str | None = None
    category_name: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None
    asset_type: str
    status: str
    assignment: AssetPortalAssignmentSummary | None = None
    warranty: AssetPortalWarrantySummary | None = None
    insurance: AssetPortalInsuranceSummary | None = None
    self_service_path: str
    discovery_profile_json: dict | None = None
    version: int | None = None


class DiscoveryCommandResponse(BaseModel):
    platform: str
    command: str


class DiscoveryParseRequest(BaseModel):
    platform: str
    raw_output: str


class DiscoveryChangeItem(BaseModel):
    path: str
    before: object | None = None
    after: object | None = None


class DiscoveryParseResult(BaseModel):
    asset_id: UUID
    platform: str
    profile: dict
    changes: list[DiscoveryChangeItem]
    current_serial_number: str | None = None
    proposed_serial_number: str | None = None
    persisted: bool = False


class DiscoveryApplyRequest(BaseModel):
    platform: str
    raw_output: str
    version: int
    preview_confirmed: bool = False


class DiscoveryApplyResult(BaseModel):
    asset_id: UUID
    version: int
    serial_number: str | None = None
    discovery_profile_json: dict | None = None
    changes: list[DiscoveryChangeItem]
    applied: bool = True


class AssetComponentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    asset_id: UUID
    component_code: str | None = None
    component_name: str | None = None
    component_type: str | None = Field(default="OTHER", max_length=30)
    product_id: UUID | None = None
    serial_number: str | None = None
    quantity: Decimal | None = None
    component_asset_id: UUID | None = None


class AssetComponentUpdate(BaseModel):
    branch_id: UUID | None = None
    component_name: str | None = None
    component_type: str | None = Field(default=None, max_length=30)
    product_id: UUID | None = None
    serial_number: str | None = None
    quantity: Decimal | None = None
    version: int


class AssetComponentReplace(BaseModel):
    component_code: str | None = None
    component_name: str | None = None
    component_type: str | None = Field(default=None, max_length=30)
    product_id: UUID | None = None
    serial_number: str | None = None
    quantity: Decimal | None = None
    branch_id: UUID | None = None


class AssetComponentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    component_asset_id: UUID | None = None
    component_code: str
    component_name: str
    component_type: str = "OTHER"
    product_id: UUID | None
    serial_number: str | None
    quantity: Decimal | None
    status: str
    company_id: UUID
    version: int
    # Populated when listing for assignment wizard / availability
    availability: str | None = None
    linked_asset_code: str | None = None
    linked_asset_name: str | None = None
    linked_asset_operational_status: str | None = None


class AssetComponentListResult(BaseModel):
    items: list["AssetComponentResponse"]
    total: int
    page: int
    page_size: int


class AssetComponentTreeNode(BaseModel):
    id: UUID | str
    component_code: str
    component_name: str
    component_type: str = "OTHER"
    serial_number: str | None = None
    quantity: str | Decimal | None = None
    status: str
    product_id: UUID | str | None = None
    version: int
    component_asset_id: UUID | str | None = None
    linked_asset_code: str | None = None
    linked_asset_name: str | None = None
    linked_asset_operational_status: str | None = None


class AssetComponentTreeAsset(BaseModel):
    id: str
    asset_code: str
    asset_name: str
    status: str
    company_id: str


class AssetComponentTreeResult(BaseModel):
    asset: AssetComponentTreeAsset
    components: list[AssetComponentTreeNode]
    depth: int = 1


class AssetComponentHistoryEntry(BaseModel):
    id: str
    status: str
    component_name: str
    serial_number: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    version: int
    component_asset_id: str | None = None


class AssetComponentHistoryResult(BaseModel):
    component_id: str
    asset_id: str
    component_code: str
    current_status: str
    lineage: list[AssetComponentHistoryEntry]


class AssetComponentReplaceResult(BaseModel):
    replaced: AssetComponentResponse
    successor: AssetComponentResponse


class AssetComponentAttachableAsset(BaseModel):
    id: str
    asset_code: str
    asset_name: str
    serial_number: str | None = None
    operational_status: str | None = None
    asset_type_id: str | None = None


class AssignmentComponentReturnLine(BaseModel):
    component_id: UUID
    issue_status: str = Field(description="RETURNED | MISSING | DAMAGED | RETAINED")
    return_remarks: str | None = Field(default=None, max_length=4000)


class AssignmentComponentResponse(OrmModel):
    id: UUID
    assignment_id: UUID
    component_id: UUID
    issue_status: str
    issued_at: datetime | None = None
    returned_at: datetime | None = None
    return_condition: str | None = None
    return_remarks: str | None = None
    company_id: UUID
    version: int
    component_code: str | None = None
    component_name: str | None = None
    component_type: str | None = None
    serial_number: str | None = None
    component_status: str | None = None
    component_asset_id: UUID | None = None
    linked_asset_code: str | None = None
    linked_asset_name: str | None = None
    linked_asset_operational_status: str | None = None


class AssignmentComponentListResult(BaseModel):
    items: list[AssignmentComponentResponse]
    total: int


class AssignmentComponentSetRequest(BaseModel):
    component_ids: list[UUID] = Field(default_factory=list)


class AssetAssignmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    asset_id: UUID
    allocation_type: str
    employee_id: UUID | None = None
    employee_source: str | None = None
    manual_employee_name: str | None = Field(default=None, max_length=255)
    manual_employee_phone: str | None = Field(default=None, max_length=30)
    manual_employee_email: str | None = Field(default=None, max_length=255)
    manual_employee_deployed_to: str | None = Field(default=None, max_length=255)
    department_id: UUID | None = None
    project_id: UUID | None = None
    expected_return_at: date | None = None
    delivery_reference_number: str | None = Field(default=None, max_length=100)
    delivery_reference_status: str | None = None
    delivery_challan_signature_status: str | None = None
    assignment_remarks: str | None = Field(default=None, max_length=4000)
    component_ids: list[UUID] | None = None


class AssetAssignmentUpdate(BaseModel):
    allocation_type: str | None = None
    employee_id: UUID | None = None
    employee_source: str | None = None
    manual_employee_name: str | None = Field(default=None, max_length=255)
    manual_employee_phone: str | None = Field(default=None, max_length=30)
    manual_employee_email: str | None = Field(default=None, max_length=255)
    manual_employee_deployed_to: str | None = Field(default=None, max_length=255)
    department_id: UUID | None = None
    project_id: UUID | None = None
    expected_return_at: date | None = None
    delivery_reference_number: str | None = Field(default=None, max_length=100)
    delivery_reference_status: str | None = None
    delivery_challan_signature_status: str | None = None
    assignment_remarks: str | None = Field(default=None, max_length=4000)
    component_ids: list[UUID] | None = None
    version: int


class AssetAssignmentReturnRequest(BaseModel):
    return_condition: str = Field(default="good", description="good | outdated | dead")
    reason: str | None = Field(default=None, max_length=500)
    return_remarks: str | None = Field(default=None, max_length=4000)
    component_returns: list[AssignmentComponentReturnLine] | None = None


class AssetAssignmentResponse(OrmModel):
    id: UUID
    document_number: str
    asset_id: UUID
    allocation_type: str
    employee_id: UUID | None
    employee_source: str | None = None
    manual_employee_name: str | None = None
    manual_employee_phone: str | None = None
    manual_employee_email: str | None = None
    manual_employee_deployed_to: str | None = None
    department_id: UUID | None
    project_id: UUID | None
    allocated_at: datetime | None
    expected_return_at: date | None
    returned_at: datetime | None
    status: str
    delivery_reference_number: str | None = None
    delivery_reference_status: str
    delivery_challan_signature_status: str = "not_signed"
    assignment_remarks: str | None = None
    return_remarks: str | None = None
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int
    created_by: UUID | None = None
    component_ids: list[UUID] | None = None
    components: list[AssignmentComponentResponse] | None = None

    @field_validator("delivery_challan_signature_status", mode="before")
    @classmethod
    def _default_signature_status(cls, value: object) -> object:
        """Legacy rows / in-memory ORM without column populated → not_signed."""
        if value is None or value == "":
            return "not_signed"
        return value


class AssetAssignmentListResult(BaseModel):
    items: list["AssetAssignmentResponse"]
    total: int
    page: int
    page_size: int

class AssetTransferCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    asset_id: UUID
    to_branch_id: UUID | None = None
    to_department_id: UUID | None = None
    to_employee_id: UUID | None = None
    to_location_label: str | None = None
    to_org_location_id: UUID | None = None
    to_location_id: UUID | None = None
    to_building_id: UUID | None = None
    reason: str | None = None
    effective_date: date | None = None
    transfer_notes: str | None = None

class AssetTransferUpdate(BaseModel):
    to_branch_id: UUID | None = None
    to_department_id: UUID | None = None
    to_employee_id: UUID | None = None
    to_location_label: str | None = None
    to_org_location_id: UUID | None = None
    to_location_id: UUID | None = None
    to_building_id: UUID | None = None
    reason: str | None = None
    effective_date: date | None = None
    transfer_notes: str | None = None
    version: int

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
    from_location_label: str | None
    to_location_label: str | None
    from_org_location_id: UUID | None
    to_org_location_id: UUID | None
    effective_date: date | None
    transferred_at: datetime | None
    executed_at: datetime | None
    executed_by: UUID | None
    reason: str | None
    transfer_notes: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int
    created_by: UUID | None = None


class AssetTransferListResult(BaseModel):
    items: list["AssetTransferResponse"]
    total: int
    page: int
    page_size: int

class AssetLocationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    asset_id: UUID
    location_label: str
    org_location_id: UUID | None = None
    location_id: UUID | None = None
    building_id: UUID | None = None
    effective_from: datetime | None = None


class AssetLocationUpdate(BaseModel):
    location_label: str | None = None
    org_location_id: UUID | None = None
    location_id: UUID | None = None
    building_id: UUID | None = None
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    branch_id: UUID | None = None
    version: int


class AssetLocationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    location_label: str
    org_location_id: UUID | None
    location_id: UUID | None = None
    building_id: UUID | None = None
    effective_from: datetime | None
    effective_to: datetime | None
    is_current: bool
    status: str
    company_id: UUID
    version: int


class AssetLocationListResult(BaseModel):
    items: list["AssetLocationResponse"]
    total: int
    page: int
    page_size: int

class AssetWarrantyCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    asset_id: UUID
    vendor_id: UUID | None = None
    warranty_type: str
    start_date: date
    end_date: date
    coverage_notes: str | None = None


class AssetWarrantyUpdate(BaseModel):
    vendor_id: UUID | None = None
    warranty_type: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    coverage_notes: str | None = None
    branch_id: UUID | None = None
    version: int


class AssetWarrantyExtend(BaseModel):
    new_end_date: date


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


class AssetWarrantyListResult(BaseModel):
    items: list["AssetWarrantyResponse"]
    total: int
    page: int
    page_size: int


class AssetInsuranceCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    asset_id: UUID
    policy_number: str
    insurer_name: str
    vendor_id: UUID | None = None
    coverage_amount: Decimal | None = None
    start_date: date
    end_date: date


class AssetInsuranceUpdate(BaseModel):
    policy_number: str | None = None
    insurer_name: str | None = None
    vendor_id: UUID | None = None
    coverage_amount: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    branch_id: UUID | None = None
    version: int


class AssetInsuranceRenew(BaseModel):
    new_end_date: date


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


class AssetInsuranceListResult(BaseModel):
    items: list["AssetInsuranceResponse"]
    total: int
    page: int
    page_size: int


class MaintenancePlanCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    asset_id: UUID
    plan_name: str
    maintenance_type: str
    frequency_days: int | None = None
    frequency_meter_units: Decimal | None = None
    next_due_date: date | None = None


class MaintenancePlanUpdate(BaseModel):
    plan_name: str | None = None
    maintenance_type: str | None = None
    frequency_days: int | None = None
    frequency_meter_units: Decimal | None = None
    next_due_date: date | None = None
    branch_id: UUID | None = None
    version: int


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


class MaintenancePlanListResult(BaseModel):
    items: list["MaintenancePlanResponse"]
    total: int
    page: int
    page_size: int

class AssetMaintenanceCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    asset_id: UUID
    maintenance_type: str
    maintenance_plan_id: UUID | None = None
    scheduled_date: date | None = None
    reason: str | None = None
    expected_duration_days: int | None = None
    vendor_id: UUID | None = None
    cost_amount: Decimal | None = None
    technician_employee_id: UUID | None = None
    quality_inspection_id: UUID | None = None

class AssetMaintenanceQuickDraftCreate(BaseModel):
    asset_id: UUID
    company_id: UUID | None = None

class AssetMaintenanceStartRequest(BaseModel):
    reason: str
    expected_duration_days: int = Field(ge=1)
    maintenance_type: str | None = None
    scheduled_date: date | None = None
    vendor_id: UUID | None = None
    cost_amount: Decimal | None = None
    technician_employee_id: UUID | None = None
    version: int | None = None

class AssetMaintenanceUpdate(BaseModel):
    maintenance_type: str | None = None
    maintenance_plan_id: UUID | None = None
    scheduled_date: date | None = None
    reason: str | None = None
    expected_duration_days: int | None = Field(default=None, ge=1)
    vendor_id: UUID | None = None
    cost_amount: Decimal | None = None
    technician_employee_id: UUID | None = None
    quality_inspection_id: UUID | None = None
    version: int

class AssetMaintenanceResponse(OrmModel):
    id: UUID
    document_number: str
    asset_id: UUID
    asset_code: str | None = None
    asset_name: str | None = None
    serial_number: str | None = None
    make: str | None = None
    model: str | None = None
    maintenance_plan_id: UUID | None
    maintenance_type: str
    reason: str | None = None
    expected_duration_days: int | None = None
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
    created_by: UUID | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def expected_return_date(self) -> date | None:
        if self.scheduled_date and self.expected_duration_days:
            from datetime import timedelta

            return self.scheduled_date + timedelta(days=self.expected_duration_days)
        return None


class AssetMaintenanceListResult(BaseModel):
    items: list["AssetMaintenanceResponse"]
    total: int
    page: int
    page_size: int


class MaintenanceStartResult(BaseModel):
    status: str
    message: str | None = None
    maintenance: AssetMaintenanceResponse


class MaintenanceTimelineEvent(BaseModel):
    id: str
    kind: str
    label: str
    occurred_at: datetime
    performed_by: UUID | None = None
    detail: str | None = None


class MaintenanceTimelineResult(BaseModel):
    events: list[MaintenanceTimelineEvent]


class MaintenanceScheduleRequest(BaseModel):
    scheduled_date: date | None = None

class ServiceHistoryCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    asset_id: UUID
    maintenance_id: UUID
    service_summary: str
    parts_replaced_json: dict | list | None = None
    cost_amount: Decimal | None = None
    serviced_at: datetime | None = None


class ServiceHistoryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID
    maintenance_id: UUID
    service_summary: str
    parts_replaced_json: dict | list | None
    cost_amount: Decimal | None
    serviced_at: datetime | None
    status: str
    company_id: UUID
    version: int


class ServiceHistoryListResult(BaseModel):
    items: list["ServiceHistoryResponse"]
    total: int
    page: int
    page_size: int

class AssetDepreciationCreate(BaseModel):
    company_id: UUID | None = None
    asset_id: UUID
    period_year: int
    period_month: int
    method: str | None = None
    units_produced: Decimal | None = None
    depreciation_batch_id: UUID | None = None

class AssetDepreciationUpdate(BaseModel):
    period_year: int | None = None
    period_month: int | None = None
    method: str | None = None
    units_produced: Decimal | None = None
    version: int

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
    created_by: UUID | None = None


class AssetDepreciationListResult(BaseModel):
    items: list["AssetDepreciationResponse"]
    total: int
    page: int
    page_size: int


class DepreciationGenerateRunRequest(BaseModel):
    company_id: UUID | None = None
    period_year: int
    period_month: int


class DepreciationGenerateRunResult(BaseModel):
    depreciation_batch_id: UUID
    period_year: int
    period_month: int
    created_count: int
    skipped_count: int
    items: list[AssetDepreciationResponse]


class DepreciationCalculateRequest(BaseModel):
    units_produced: Decimal | None = None
    estimated_total_units: Decimal | None = None

class AssetDisposalCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    asset_id: UUID
    disposal_type: str
    disposal_date: date | None = None
    proceeds_amount: Decimal | None = None
    book_value_at_disposal: Decimal | None = None

class AssetDisposalUpdate(BaseModel):
    disposal_type: str | None = None
    disposal_date: date | None = None
    proceeds_amount: Decimal | None = None
    book_value_at_disposal: Decimal | None = None
    version: int

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
    created_by: UUID | None = None


class AssetDisposalListResult(BaseModel):
    items: list["AssetDisposalResponse"]
    total: int
    page: int
    page_size: int

class AssetRevaluationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    asset_id: UUID
    revaluation_date: date | None = None
    new_book_value: Decimal
    reason: str

class AssetRevaluationUpdate(BaseModel):
    revaluation_date: date | None = None
    new_book_value: Decimal | None = None
    reason: str | None = None
    version: int

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
    created_by: UUID | None = None


class AssetRevaluationListResult(BaseModel):
    items: list["AssetRevaluationResponse"]
    total: int
    page: int
    page_size: int

class AssetAuditCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    asset_id: UUID
    auditor_employee_id: UUID
    audit_date: date | None = None
    found_status: str | None = None
    notes: str | None = None

class AssetAuditUpdate(BaseModel):
    auditor_employee_id: UUID | None = None
    audit_date: date | None = None
    found_status: str | None = None
    notes: str | None = None
    version: int

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


class AssetAuditListResult(BaseModel):
    items: list["AssetAuditResponse"]
    total: int
    page: int
    page_size: int

class AssetDocumentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    asset_id: UUID
    document_type: str
    document_name: str
    storage_uri: str | None = None
    content_hash: str | None = None


class AssetDocumentUpdate(BaseModel):
    document_name: str | None = None
    storage_uri: str | None = None
    content_hash: str | None = None
    branch_id: UUID | None = None
    version: int


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


class AssetDocumentListResult(BaseModel):
    items: list["AssetDocumentResponse"]
    total: int
    page: int
    page_size: int


# Planning aliases (DOC naming) — prefer AssetDocument* in OpenAPI to avoid doc_* collision.
DocumentCreate = AssetDocumentCreate
DocumentUpdate = AssetDocumentUpdate
DocumentResponse = AssetDocumentResponse
DocumentListResult = AssetDocumentListResult

class AssetChecklistCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    asset_id: UUID | None = None
    maintenance_id: UUID | None = None
    audit_id: UUID | None = None
    checklist_code: str
    checklist_name: str
    items_json: dict | list | None = None


class AssetChecklistUpdate(BaseModel):
    checklist_name: str | None = None
    items_json: dict | list | None = None
    branch_id: UUID | None = None
    version: int


class AssetChecklistResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    asset_id: UUID | None
    maintenance_id: UUID | None
    audit_id: UUID | None
    checklist_code: str
    checklist_name: str
    items_json: dict | list | None
    completed_at: datetime | None
    status: str
    company_id: UUID
    version: int


class AssetChecklistListResult(BaseModel):
    items: list["AssetChecklistResponse"]
    total: int
    page: int
    page_size: int

class MeterReadingCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    asset_id: UUID
    meter_type: str
    reading_value: Decimal
    reading_at: datetime
    recorded_by_employee_id: UUID | None = None


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


class MeterReadingListResult(BaseModel):
    items: list["MeterReadingResponse"]
    total: int
    page: int
    page_size: int

class AssetNotificationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    asset_id: UUID
    notification_type: str
    recipient_user_id: UUID | None = None
    recipient_employee_id: UUID | None = None
    payload_json: dict | None = None


class AssetNotificationUpdate(BaseModel):
    branch_id: UUID | None = None
    recipient_user_id: UUID | None = None
    recipient_employee_id: UUID | None = None
    payload_json: dict | None = None
    version: int


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


class AssetNotificationListResult(BaseModel):
    items: list["AssetNotificationResponse"]
    total: int
    page: int
    page_size: int

class AssetReportCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    report_key: str
    period_start: date | None = None
    period_end: date | None = None
    department_id: UUID | None = None
    category_id: UUID | None = None
    status: str | None = None


class AssetReportGenerate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID | None = None
    report_key: str
    period_start: date | None = None
    period_end: date | None = None
    department_id: UUID | None = None
    category_id: UUID | None = None
    status: str | None = None


class AssetReportUpdate(BaseModel):
    branch_id: UUID | None = None
    department_id: UUID | None = None
    category_id: UUID | None = None
    period_start: date | None = None
    period_end: date | None = None
    version: int


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


class AssetReportListResult(BaseModel):
    items: list["AssetReportResponse"]
    total: int
    page: int
    page_size: int


class AssetReportCatalogItem(BaseModel):
    key: str
    title: str
    category: str


class AssetReportDashboardResponse(BaseModel):
    generated_at: str
    horizon_days: int
    kpis: dict
    by_category: list[dict]
    by_department: list[dict]
    recent_transfers: list[dict]
    recent_notifications: list[dict]
    health: dict


class AssetReportRunResult(BaseModel):
    report_key: str
    generated_at: str
    filters: dict
    totals: dict
    items: list[dict]
    total: int
    page: int
    page_size: int


class AssetReportExportResult(BaseModel):
    report_key: str
    generated_at: str
    format_hints: list[str]
    columns: list[dict]
    rows: list[dict]
    row_count: int
    filters: dict


class FinancePostRequest(BaseModel):
    debit_account_id: UUID
    credit_account_id: UUID
    fiscal_year_id: UUID | None = None


class WorkflowActionRequest(BaseModel):
    comments: str | None = None


class AssetExcelImportDefaults(BaseModel):
    asset_category_id: UUID | None = None
    asset_type: str = "fixed"
    purchase_date: date | None = None
    purchase_cost: Decimal = Decimal("0")
    currency_code: str = "USD"


class AssetExcelImportRow(BaseModel):
    """Preview-validated row resolved to ERP IDs (Phase 8A → 8B)."""

    row_number: int = Field(ge=1)
    preview_status: str = Field(description="valid | warning | invalid")
    asset_tag: str | None = Field(default=None, max_length=100)
    asset_name: str = Field(min_length=1, max_length=255)
    branch_id: UUID | None = None
    operational_status: str
    employee_id: UUID | None = None
    department_id: UUID | None = None
    asset_category_id: UUID | None = None
    asset_type_id: UUID
    serial_number: str | None = Field(default=None, max_length=100)
    make: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    configuration: str | None = Field(default=None, max_length=500)
    location_label: str | None = Field(default=None, max_length=255)
    location_id: UUID | None = None
    issue_date: date | None = None
    delivery_reference_number: str | None = Field(default=None, max_length=100)
    delivery_reference_status: str | None = None
    delivery_challan_signature_status: str | None = None
    assignment_remarks: str | None = Field(default=None, max_length=4000)
    company_id: UUID | None = None


class AssetExcelImportRequest(BaseModel):
    company_id: UUID | None = None
    batch_size: int = Field(default=50, ge=1, le=500)
    confirm_warnings: bool = False
    defaults: AssetExcelImportDefaults
    rows: list[AssetExcelImportRow]


class AssetExcelImportRowResult(BaseModel):
    row_number: int
    outcome: str
    reason: str | None = None
    asset_id: UUID | None = None
    assignment_id: UUID | None = None
    operational_status: str | None = None
    warning: bool = False


class AssetExcelImportSummaryResponse(BaseModel):
    total_rows: int
    imported: int
    skipped: int
    duplicates: int
    warnings: int
    failed: int
    duration_ms: int
    batch_count: int
    rows: list[AssetExcelImportRowResult] = []


# --- Incoming Assets (IT receiving / Sub-phase 1–2 QC) ---


class IncomingAssetUnitResponse(OrmModel):
    id: UUID
    unit_index: int
    serial_number: str | None = None
    status: str
    arrived_at: datetime | None = None
    arrived_by: UUID | None = None
    qc_status: str | None = None
    tested_at: datetime | None = None
    tested_by: UUID | None = None
    qc_notes: str | None = None
    rejection_reason: str | None = None
    evidence_uri: str | None = None
    quality_inspection_id: UUID | None = None
    registered_asset_id: UUID | None = None
    registered_at: datetime | None = None
    registered_by: UUID | None = None


class IncomingAssetLineResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    grn_id: UUID
    grn_line_id: UUID
    purchase_order_id: UUID | None = None
    product_id: UUID
    vendor_id: UUID | None = None
    grn_document_number: str
    po_document_number: str | None = None
    product_code: str | None = None
    product_name: str | None = None
    document_date: date | None = None
    expected_quantity: Decimal
    arrived_quantity: Decimal
    pending_quantity: Decimal
    accepted_quantity: Decimal = Decimal("0")
    rejected_quantity: Decimal = Decimal("0")
    pending_qc_quantity: Decimal = Decimal("0")
    status: str
    qc_status: str = "PENDING"
    qc_started_at: datetime | None = None
    qc_started_by: UUID | None = None
    qc_notes: str | None = None
    quality_inspection_id: UUID | None = None
    version: int
    units: list[IncomingAssetUnitResponse] = []


class IncomingAssetListResult(BaseModel):
    items: list[IncomingAssetLineResponse]
    total: int
    page: int
    page_size: int


class IncomingAssetSummaryResponse(BaseModel):
    expected_lines: int
    pending_arrival_lines: int
    partially_arrived_lines: int
    arrived_lines: int
    expected_quantity_total: float = 0
    arrived_quantity_total: float = 0
    pending_quantity_total: float = 0


class IncomingAssetArriveUnit(BaseModel):
    unit_index: int = Field(ge=1)
    serial_number: str | None = None


class IncomingAssetArriveRequest(BaseModel):
    quantity: float | None = Field(default=None, gt=0)
    mark_all: bool = False
    units: list[IncomingAssetArriveUnit] | None = None
    notes: str | None = None


class IncomingAssetQcEventResponse(OrmModel):
    id: UUID
    disposition: str
    quantity: Decimal
    notes: str | None = None
    rejection_reason: str | None = None
    evidence_uri: str | None = None
    unit_ids_json: str | None = None
    quality_inspection_id: UUID | None = None
    created_at: datetime | None = None
    created_by: UUID | None = None


class IncomingAssetQcLineResponse(OrmModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    grn_id: UUID
    grn_line_id: UUID
    purchase_order_id: UUID | None = None
    product_id: UUID
    vendor_id: UUID | None = None
    grn_document_number: str
    po_document_number: str | None = None
    product_code: str | None = None
    product_name: str | None = None
    document_date: date | None = None
    expected_quantity: Decimal
    arrived_quantity: Decimal
    accepted_quantity: Decimal
    rejected_quantity: Decimal
    pending_qc_quantity: Decimal
    pending_quantity: Decimal
    status: str
    qc_status: str
    qc_started_at: datetime | None = None
    qc_started_by: UUID | None = None
    qc_notes: str | None = None
    quality_inspection_id: UUID | None = None
    version: int
    units: list[IncomingAssetUnitResponse] = []
    qc_events: list[IncomingAssetQcEventResponse] = []


class IncomingAssetQcListResult(BaseModel):
    items: list[IncomingAssetQcLineResponse]
    total: int
    page: int
    page_size: int


class IncomingAssetQcDispositionRequest(BaseModel):
    quantity: float | None = Field(default=None, gt=0)
    unit_ids: list[UUID] | None = None
    mark_all_pending: bool = False
    notes: str | None = None
    rejection_reason: str | None = None
    evidence_uri: str | None = None
    quality_inspection_id: UUID | None = None


# --- Incoming Registration Queue (Sub-phase 3) ---


class IncomingRegistrationPrefillResponse(BaseModel):
    incoming_line_id: UUID
    incoming_unit_id: UUID
    unit_index: int
    grn_id: UUID
    grn_document_number: str
    purchase_order_id: UUID | None = None
    po_document_number: str | None = None
    branch_id: UUID
    product_id: UUID
    supplier_vendor_id: UUID | None = None
    quality_inspection_id: UUID | None = None
    asset_name: str
    serial_number: str | None = None
    purchase_date: date | None = None
    purchase_cost: Decimal | None = None
    currency_code: str = "INR"
    asset_category_id: UUID | None = None
    asset_type: str = "fixed"
    qc_status: str
    registration_status: str
    registered_asset_id: UUID | None = None


class RegistrationQueueItemResponse(BaseModel):
    incoming_unit_id: UUID
    incoming_line_id: UUID
    unit_index: int
    unit_reference: str
    product_name: str | None = None
    product_code: str | None = None
    serial_number: str | None = None
    grn_id: UUID
    grn_document_number: str
    purchase_order_id: UUID | None = None
    po_document_number: str | None = None
    branch_id: UUID
    qc_status: str
    registration_status: str
    line_registration_status: str
    registered_asset_id: UUID | None = None


class RegistrationQueueListResult(BaseModel):
    items: list[RegistrationQueueItemResponse]
    total: int
    page: int
    page_size: int


class RegistrationQueueSummaryResponse(BaseModel):
    accepted: int
    registered: int
    pending_registration: int


class RegistrationExcelRowInput(BaseModel):
    incoming_unit_id: str | None = None
    asset_name: str | None = None
    serial_number: str | None = None
    branch_id: str | None = None
    asset_category_id: str | None = None
    asset_type: str | None = None
    purchase_date: str | None = None
    purchase_cost: str | None = None
    currency_code: str | None = None
    make: str | None = None
    model: str | None = None
    configuration: str | None = None
    location: str | None = None


class RegistrationExcelValidateRequest(BaseModel):
    rows: list[RegistrationExcelRowInput]


class RegistrationExcelRowResult(BaseModel):
    row_number: int
    status: str
    errors: list[str] = []
    incoming_unit_id: str | None = None
    asset_name: str | None = None
    serial_number: str | None = None
    branch_id: str | None = None
    asset_category_id: str | None = None
    asset_type: str | None = None
    purchase_date: str | None = None
    purchase_cost: str | None = None
    currency_code: str | None = None
    make: str | None = None
    model: str | None = None
    configuration: str | None = None
    location: str | None = None
    grn_document_number: str | None = None
    po_document_number: str | None = None
    qc_status: str | None = None


class RegistrationExcelValidateResult(BaseModel):
    valid_count: int
    error_count: int
    warning_count: int = 0
    rows: list[RegistrationExcelRowResult]


class RegistrationExcelConfirmRequest(BaseModel):
    rows: list[RegistrationExcelRowInput]
    activate: bool = True


class RegistrationExcelConfirmItem(BaseModel):
    row_number: int
    incoming_unit_id: str
    asset_id: str
    asset_code: str | None = None
    created: bool = True
    activation: str
    activation_error: str | None = None
    operational_status: str | None = None


class RegistrationExcelConfirmResult(BaseModel):
    registered_count: int
    activation_complete: int
    activation_incomplete: int
    items: list[RegistrationExcelConfirmItem]


# --- DC Challan (standalone IT ↔ SCM paperwork) ---


class DcChallanDocumentResponse(BaseModel):
    id: UUID | None = None
    doc_kind: str
    original_filename: str | None = None
    content_type: str | None = None
    file_size_bytes: int | None = None
    checksum_sha256: str | None = None
    source: str | None = None
    uploaded_by_user_id: UUID | None = None
    uploaded_at: datetime | None = None
    external_url: str | None = None
    is_legacy: bool = False
    has_stored_file: bool = False


class DcChallanLegacyContentResponse(BaseModel):
    is_legacy: bool = True
    external_url: str
    doc_kind: str


class DcChallanCreate(BaseModel):
    company_id: UUID | None = None
    asset_id: UUID
    assignment_id: UUID | None = None
    employee_id: UUID | None = None
    employee_code: str | None = None
    employee_name: str | None = None
    employee_phone: str | None = None
    employee_email: str | None = None
    remarks: str | None = None


class DcChallanUpdate(BaseModel):
    employee_code: str | None = None
    employee_name: str | None = None
    employee_phone: str | None = None
    employee_email: str | None = None
    asset_name: str | None = None
    asset_tag: str | None = None
    make: str | None = None
    model: str | None = None
    serial_number: str | None = None
    purchase_cost: Decimal | None = None
    remarks: str | None = None


class DcChallanUploadLimits(BaseModel):
    max_upload_mb: int = 10
    allowed_content_types: list[str] = ["application/pdf", "image/jpeg", "image/png"]


class DcChallanResponse(OrmModel):
    id: UUID
    dc_number: str
    asset_id: UUID
    assignment_id: UUID | None = None
    employee_id: UUID | None = None
    status: str
    company_id: UUID
    branch_id: UUID
    employee_code: str | None = None
    employee_name: str | None = None
    employee_phone: str | None = None
    employee_email: str | None = None
    deployed_to: str | None = None
    asset_name: str | None = None
    asset_tag: str | None = None
    make: str | None = None
    model: str | None = None
    serial_number: str | None = None
    purchase_cost: Decimal | None = None
    sent_to_scm_at: datetime | None = None
    scm_reference_number: str | None = None
    scm_document_url: str | None = None
    scm_document_uploaded_at: datetime | None = None
    signed_document_url: str | None = None
    signed_document_uploaded_at: datetime | None = None
    signed_at: datetime | None = None
    received_at: datetime | None = None
    remarks: str | None = None
    version: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
    scm_issued_document: DcChallanDocumentResponse | None = None
    signed_document: DcChallanDocumentResponse | None = None


class DcChallanListResult(BaseModel):
    items: list[DcChallanResponse]
    total: int
    page: int
    page_size: int
    upload_limits: DcChallanUploadLimits = Field(default_factory=DcChallanUploadLimits)


class DcChallanSummaryResponse(BaseModel):
    pending: int = 0
    sent_to_scm: int = 0
    document_received: int = 0
    signed: int = 0
    received: int = 0
    cancelled: int = 0
    upload_limits: DcChallanUploadLimits = Field(default_factory=DcChallanUploadLimits)


class DcChallanLinkAssignmentRequest(BaseModel):
    assignment_id: UUID


class DcChallanAttachDocumentRequest(BaseModel):
    document_url: str
    scm_reference_number: str | None = None


class DcChallanMarkSignedRequest(BaseModel):
    signed_document_url: str | None = None


class DcChallanScmCallbackRequest(BaseModel):
    document_url: str
    scm_reference_number: str | None = None


class DcChallanBulkSendRequest(BaseModel):
    ids: list[UUID] = Field(min_length=1)


class DcChallanBulkSendItem(BaseModel):
    id: UUID
    ok: bool
    reason: str | None = None


class DcChallanBulkSendResult(BaseModel):
    results: list[DcChallanBulkSendItem]
    sent_count: int
    skipped_count: int


# --- Domain membership (IT / Non-IT teams) ---


class DomainMembershipCreate(BaseModel):
    user_id: UUID
    domain: str
    role: str = "member"
    company_id: UUID | None = None


class DomainMembershipUpdate(BaseModel):
    role: str


class DomainMembershipResponse(OrmModel):
    id: UUID
    user_id: UUID
    display_name: str | None = None
    email: str | None = None
    domain: str
    role: str
    assigned_at: datetime
    assigned_by: UUID | None = None
    company_id: UUID
    version: int


class DomainMembershipListResult(BaseModel):
    items: list[DomainMembershipResponse]
    total: int


class DomainMembershipUserOption(BaseModel):
    user_id: UUID
    display_name: str
    email: str


class DomainMembershipMeMembership(BaseModel):
    id: UUID
    domain: str
    role: str


class DomainMembershipMeResponse(BaseModel):
    is_module_admin: bool
    domains: list[str]
    admin_domains: list[str] = []
    memberships: list[DomainMembershipMeMembership]
