"""Procurement Pydantic schemas."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# --- Requisition ---


class RequisitionCreateRequest(BaseModel):
    branch_id: UUID
    document_date: date
    requester_id: UUID
    department_id: UUID
    cost_center_id: UUID
    required_date: date
    currency_code: str
    priority: str = "medium"
    exchange_rate: float = 1.0
    notes: str | None = None
    company_id: UUID | None = None


class RequisitionUpdateRequest(BaseModel):
    required_date: date | None = None
    priority: str | None = None
    notes: str | None = None
    version: int | None = None


class RequisitionLineCreateRequest(BaseModel):
    line_number: int
    product_id: UUID
    product_code: str | None = None
    product_name: str | None = None
    quantity: float
    uom_id: UUID
    estimated_unit_cost: float | None = None
    tax_id: UUID | None = None
    required_date: date | None = None


class RequisitionLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    line_number: int
    product_id: UUID
    product_code: str | None = None
    product_name: str | None = None
    quantity: float
    estimated_unit_cost: float | None = None
    tax_amount: float
    line_total: float
    status: str


class RequisitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    requester_id: UUID
    department_id: UUID
    cost_center_id: UUID
    required_date: date
    priority: str
    currency_code: str
    subtotal_amount: float
    tax_amount: float
    total_amount: float
    status: str
    workflow_status: str | None = None
    workflow_instance_id: UUID | None = None
    version: int
    lines: list[RequisitionLineResponse] = Field(default_factory=list)


# --- RFQ ---


class RfqCreateRequest(BaseModel):
    branch_id: UUID
    document_date: date
    closing_date: date
    currency_code: str
    requisition_header_id: UUID | None = None
    exchange_rate: float = 1.0
    notes: str | None = None
    company_id: UUID | None = None


class RfqUpdateRequest(BaseModel):
    closing_date: date | None = None
    notes: str | None = None
    version: int | None = None


class RfqLineCreateRequest(BaseModel):
    line_number: int
    product_id: UUID
    quantity: float
    uom_id: UUID
    requisition_line_id: UUID | None = None
    target_unit_cost: float | None = None


class RfqVendorCreateRequest(BaseModel):
    vendor_id: UUID


class RfqLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    line_number: int
    product_id: UUID
    quantity: float
    target_unit_cost: float | None = None
    status: str


class RfqVendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    invite_status: str
    sent_at: datetime | None = None
    responded_at: datetime | None = None


class RfqResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    requisition_header_id: UUID | None = None
    closing_date: date
    currency_code: str
    status: str
    workflow_status: str | None = None
    workflow_instance_id: UUID | None = None
    version: int
    lines: list[RfqLineResponse] = Field(default_factory=list)
    vendors: list[RfqVendorResponse] = Field(default_factory=list)


# --- Vendor Quotation ---


class VendorQuotationCreateRequest(BaseModel):
    branch_id: UUID
    document_date: date
    rfq_header_id: UUID
    vendor_id: UUID
    valid_until: date
    currency_code: str
    vendor_quote_reference: str | None = None
    payment_terms: str | None = None
    delivery_days: int | None = None
    exchange_rate: float = 1.0
    company_id: UUID | None = None


class VendorQuotationUpdateRequest(BaseModel):
    valid_until: date | None = None
    payment_terms: str | None = None
    delivery_days: int | None = None
    vendor_quote_reference: str | None = None
    version: int | None = None


class VendorQuotationLineCreateRequest(BaseModel):
    line_number: int
    product_id: UUID
    quantity: float
    uom_id: UUID
    unit_cost: float
    rfq_line_id: UUID | None = None
    lead_time_days: int | None = None
    tax_id: UUID | None = None
    tax_rate: float = 0
    is_alternate_product: bool = False


class VendorQuotationLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    line_number: int
    product_id: UUID
    quantity: float
    unit_cost: float
    tax_amount: float
    line_total: float
    status: str


class VendorQuotationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    rfq_header_id: UUID
    vendor_id: UUID
    valid_until: date
    currency_code: str
    subtotal_amount: float
    tax_amount: float
    total_amount: float
    status: str
    version: int
    lines: list[VendorQuotationLineResponse] = Field(default_factory=list)


class VendorQuotationSelectRequest(BaseModel):
    quotation_id: UUID


# --- Purchase Order ---


class OrderCreateRequest(BaseModel):
    branch_id: UUID
    document_date: date
    vendor_id: UUID
    currency_code: str
    exchange_rate: float = 1.0
    requisition_header_id: UUID | None = None
    rfq_header_id: UUID | None = None
    vendor_quotation_header_id: UUID | None = None
    contract_id: UUID | None = None
    payment_terms: str | None = None
    expected_delivery_date: date | None = None
    company_id: UUID | None = None


class OrderUpdateRequest(BaseModel):
    payment_terms: str | None = None
    expected_delivery_date: date | None = None
    order_ref_cache: str | None = Field(default=None, max_length=100)
    version: int | None = None


class OrderLineCreateRequest(BaseModel):
    line_number: int
    product_id: UUID
    product_code: str | None = None
    product_name: str | None = None
    quantity: float
    uom_id: UUID
    unit_cost: float
    discount_percent: float = 0
    discount_amount: float = 0
    tax_id: UUID | None = None
    tax_rate: float = 0


class OrderLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    line_number: int
    product_id: UUID
    product_code: str | None = None
    product_name: str | None = None
    description: str | None = None
    quantity: float
    quantity_received: float
    last_receipt_qty: float = 0
    last_receipt_batch_id: UUID | None = None
    last_receipt_serial_numbers: list[str] | None = None
    last_receipt_billing: bool = True
    last_receipt_billing_quantity: float = 0
    last_receipt_delivery_challan_quantity: float = 0
    unit_cost: float
    rate_currency: str = "INR"
    tax_rate: float = 0
    line_total: float
    status: str

    @field_validator("last_receipt_serial_numbers", mode="before")
    @classmethod
    def coerce_serial_numbers(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        if not isinstance(value, list):
            return None
        out: list[str] = []
        for item in value:
            text = str(item).strip()
            if text:
                out.append(text)
        return out or None


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    vendor_id: UUID
    requisition_header_id: UUID | None = None
    rfq_header_id: UUID | None = None
    vendor_quotation_header_id: UUID | None = None
    contract_id: UUID | None = None
    currency_code: str
    payment_terms: str | None = None
    expected_delivery_date: date | None = None
    awb_number: str | None = None
    delivery_milestone: str | None = None
    actual_delivery_date: date | None = None
    total_amount: float
    received_amount: float = 0
    status: str
    workflow_status: str | None = None
    scm_approval_stage: Literal["accept_po", "management"] | None = None
    source_module: str | None = None
    source_document_type: str | None = None
    source_document_id: UUID | None = None
    order_kind: str = "product"
    company_po_number: str | None = None
    entity_code: str | None = None
    baseline_amount: float = 0
    negotiated_savings_amount: float = 0
    negotiation_status: str = "not_required"
    negotiation_decided_by_name: str | None = None
    etd_confirmed_at: datetime | None = None
    customer_ack_sent_at: datetime | None = None
    etd_reminder_last_sent_at: datetime | None = None
    fulfillment_stage: str | None = None
    vendor_response_status: str | None = None
    vendor_response_remark: str | None = None
    vendor_responded_at: datetime | None = None
    customer_promised_delivery_date: date | None = None
    po_sent_to_vendor_at: datetime | None = None
    customer_order_processed_sent_at: datetime | None = None
    customer_dispatch_shared_at: datetime | None = None
    customer_pod_uploaded_at: datetime | None = None
    customer_delivery_meta: dict | None = None
    customer_name: str | None = None
    ovf_no: str | None = None
    approved_by_name: str | None = None
    order_ref_cache: str | None = None
    ovf_date: date | None = None
    customer_po_number: str | None = None
    customer_payment_days: int = 0
    vendor_total: float = 0
    customer_total: float = 0
    customer_tax_amount: float = 0
    customer_total_with_tax: float = 0
    vendor_tax_amount: float = 0
    vendor_total_with_tax: float = 0
    margin_amount: float = 0
    margin_pct: float = 0
    description: str | None = None
    current_receipt_batch_id: UUID | None = None
    current_receipt_batch_at: datetime | None = None
    current_grn_number: str | None = None
    grn_sequence: int = 0
    version: int
    lines: list[OrderLineResponse] = Field(default_factory=list)


# --- SCM handoff (CRM OVF → vendor PO → GRN) ---


class ScmStockAvailability(BaseModel):
    product_name: str
    required_qty: float = 0
    on_hand_qty: float = 0
    allocated_qty: float = 0
    remaining_qty: float = 0


class ScmItemPlanLine(BaseModel):
    product_name: str
    qty: float = 0
    distributor_name: str | None = None
    source: str = "purchase_order"  # inventory | purchase_order
    on_hand_qty: float = 0
    allocated_qty: float = 0
    book_qty: float = 0
    po_qty: float = 0
    in_stock: bool = False
    action: str = "create_po"  # book_stock | stock_short | create_po | no_vendor


class ScmItemPlan(BaseModel):
    lines: list[ScmItemPlanLine] = Field(default_factory=list)
    delivery: str = "together"  # together | separate
    delivery_note: str = ""


class ScmLinkedPurchaseOrder(BaseModel):
    id: UUID
    vendor_id: UUID | None = None
    vendor_name: str | None = None
    document_number: str | None = None
    company_po_number: str | None = None
    status: str | None = None
    fulfillment_stage: str | None = None
    # Sum of active PO line quantities (partial Create PO coverage).
    total_qty: float = 0


class ScmPoGroup(BaseModel):
    distributor_name: str | None = None
    line_count: int = 0
    has_po: bool = False
    purchase_order_id: UUID | None = None
    document_number: str | None = None
    company_po_number: str | None = None
    status: str | None = None
    required_qty: float = 0
    ordered_qty: float = 0


class ScmQueueItemResponse(BaseModel):
    ovf_id: UUID
    ovf_no: str
    customer_name: str | None = None
    quote_name: str | None = None
    account_name: str | None = None
    po_number: str | None = None
    company_po_number: str | None = None
    owner_name: str | None = None
    blueprint_state: str
    company_id: UUID
    branch_id: UUID
    vendor_line_count: int = 0
    vendor_qty: float = 0
    vendor_total: float = 0
    customer_total: float = 0
    customer_total_with_tax: float = 0
    margin_amount: float = 0
    vendor_payment_days: int = 0
    customer_payment_days: int = 0
    vendor_name: str | None = None
    oem_name: str | None = None
    distributor_name: str | None = None
    project_title: str | None = None
    received_at: datetime | None = None
    delivery_period: str | None = None
    expected_delivery_date: date | None = None
    purchase_order_id: UUID | None = None
    purchase_order_number: str | None = None
    purchase_order_status: str | None = None
    scm_on_hold: bool = False
    scm_on_hold_at: datetime | None = None
    can_create_po: bool = True
    open_distributor_names: list[str] = Field(default_factory=list)
    po_groups: list[ScmPoGroup] = Field(default_factory=list)
    purchase_orders: list[ScmLinkedPurchaseOrder] = Field(default_factory=list)
    # Non-stock vendor demand qty that needs Create PO coverage.
    required_po_qty: float = 0
    stock_fulfillment_status: str = "none"
    remaining_demand_qty: float = 0
    stock_availability: list[ScmStockAvailability] = Field(default_factory=list)
    item_plan: ScmItemPlan = Field(default_factory=ScmItemPlan)


class ScmNextCompanyPoResponse(BaseModel):
    entity_code: str
    company_po_number: str


class ScmVendorLinePreview(BaseModel):
    line_id: UUID
    line_no: int
    product_name: str
    description: str | None = None
    qty: float
    unit_price: float
    line_total: float
    gst_pct: float = 0
    gst_amount: float = 0
    total_with_gst: float = 0
    # CRM Vendor Charges "Distributor Name" (IN STOCK ⇒ inventory; else create PO).
    distributor_name: str | None = None
    fulfillment_source: str | None = None  # inventory | purchase_order


class ScmMarginLinePreview(BaseModel):
    line_no: int
    product_name: str
    description: str | None = None
    qty: float
    margin_amount: float
    margin_pct: float


class ScmOvfHoldHistoryEntry(BaseModel):
    started_at: datetime
    released_at: datetime
    remark: str | None = None


class ScmOvfHoldRequest(BaseModel):
    remark: str = Field(..., min_length=1, max_length=2000)


class ScmHoldApprovalResponse(BaseModel):
    id: UUID
    ovf_id: UUID
    ovf_no: str
    customer_name: str | None = None
    owner_name: str | None = None
    status: str
    remark: str | None = None
    requested_at: datetime | None = None
    requested_by_name: str | None = None


class ScmChargeApprovalResponse(BaseModel):
    id: UUID
    ovf_id: UUID
    ovf_no: str
    customer_name: str | None = None
    owner_name: str | None = None
    status: str
    freight: float = 0
    finance_cost_pct: float = 0
    requested_at: datetime | None = None
    requested_by_name: str | None = None


class ScmOvfStockAllocationRow(BaseModel):
    id: UUID
    stock_unit_id: UUID
    product_name: str
    quantity: float
    serial_number: str


class ScmFulfillFromStockLineRequest(BaseModel):
    product_name: str = Field(min_length=1, max_length=255)
    stock_unit_ids: list[UUID] = Field(default_factory=list)


class ScmFulfillFromStockRequest(BaseModel):
    lines: list[ScmFulfillFromStockLineRequest] = Field(min_length=1)


class ScmOvfStockChallanLine(BaseModel):
    product_name: str
    description: str | None = None
    quantity: float
    serial_number: str
    rate: float = 0
    stock_unit_id: UUID


class ScmOvfStockChallanPrefill(BaseModel):
    ovf_id: UUID
    ovf_no: str
    source_key: str
    customer_name: str | None = None
    customer_bill_to: str | None = None
    customer_ship_to: str | None = None
    customer_gst: str | None = None
    po_number: str | None = None
    po_date: date | None = None
    kind_attn: str | None = None
    lines: list[ScmOvfStockChallanLine] = Field(default_factory=list)


class ScmFulfillFromStockResponse(BaseModel):
    ovf_id: UUID
    stock_fulfillment_status: str
    remaining_demand_qty: float = 0
    stock_availability: list[ScmStockAvailability] = Field(default_factory=list)
    stock_allocations: list[ScmOvfStockAllocationRow] = Field(default_factory=list)
    challan_prefill: ScmOvfStockChallanPrefill


class ScmOvfPreviewResponse(BaseModel):
    ovf_id: UUID
    ovf_no: str
    company_id: UUID
    branch_id: UUID
    quote_id: UUID
    opportunity_id: UUID
    quote_no: str | None = None
    po_number: str | None = None
    po_date: date | None = None
    delivery_period: str | None = None
    customer_name: str | None = None
    customer_account_number: str | None = None
    quote_name: str | None = None
    account_name: str | None = None
    owner_name: str | None = None
    project_title: str | None = None
    oem_name: str | None = None
    oem_contact_person: str | None = None
    oem_contact_email: str | None = None
    oem_contact_number: str | None = None
    distributor_name: str | None = None
    distributor_contact_person: str | None = None
    distributor_contact: str | None = None
    distributor_contact_email: str | None = None
    blueprint_state: str
    approval_status: str | None = None
    freight: float = 0
    additional_charges: float = 0
    vendor_payment_days: int = 0
    customer_payment_days: int = 0
    finance_cost_pct: float = 0
    total_margin_amount: float = 0
    total_margin_pct: float = 0
    products_margin_amount: float = 0
    billing_address: str | None = None
    shipping_address: str | None = None
    billing_state: str | None = None
    shipping_state: str | None = None
    billing_contact_person: str | None = None
    shipping_contact_person: str | None = None
    customer_gst: str | None = None
    tax_percentage: float = 0
    ovf_approver: str | None = None
    vendor_name: str | None = None
    company_po_number: str | None = None
    vendor_lines: list[ScmVendorLinePreview] = Field(default_factory=list)
    customer_lines: list[ScmVendorLinePreview] = Field(default_factory=list)
    margin_lines: list[ScmMarginLinePreview] = Field(default_factory=list)
    purchase_order_id: UUID | None = None
    purchase_order_number: str | None = None
    can_create_po: bool = True
    open_distributor_names: list[str] = Field(default_factory=list)
    po_groups: list[ScmPoGroup] = Field(default_factory=list)
    purchase_orders: list[ScmLinkedPurchaseOrder] = Field(default_factory=list)
    required_po_qty: float = 0
    scm_on_hold: bool = False
    scm_on_hold_at: datetime | None = None
    scm_hold_blocked: bool = False
    scm_last_hold_since: datetime | None = None
    scm_last_hold_released_at: datetime | None = None
    scm_hold_history: list[ScmOvfHoldHistoryEntry] = Field(default_factory=list)
    scm_on_hold_remark: str | None = None
    scm_hold_request_status: str | None = None
    scm_hold_request_remark: str | None = None
    scm_hold_requested_at: datetime | None = None
    scm_charge_request_status: str | None = None
    scm_charge_request_freight: float | None = None
    scm_charge_request_finance_pct: float | None = None
    scm_charge_requested_at: datetime | None = None
    purchase_order_status: str | None = None
    stock_fulfillment_status: str = "none"
    remaining_demand_qty: float = 0
    stock_availability: list[ScmStockAvailability] = Field(default_factory=list)
    stock_allocations: list[ScmOvfStockAllocationRow] = Field(default_factory=list)
    item_plan: ScmItemPlan = Field(default_factory=ScmItemPlan)


class ScmCreatePoFromOvfLineRequest(BaseModel):
    """Optional SCM Create-PO line overrides (form edits); otherwise OVF vendor lines are used."""

    product_name: str = Field(min_length=1, max_length=255)
    qty: float = Field(gt=0)
    unit_price: float = Field(gt=0)
    rate_currency: str = Field(default="INR", max_length=3)
    tax_rate: float = Field(default=0, ge=0)
    description: str | None = Field(default=None, max_length=4000)


class ScmCreatePoFromOvfRequest(BaseModel):
    vendor_id: UUID
    document_date: date | None = None
    currency_code: str = "INR"
    payment_terms: str | None = None
    expected_delivery_date: date | None = None
    entity_code: str
    order_ref_cache: str | None = Field(default=None, max_length=100)
    finalize: bool = False
    # Hold: create draft then cancel so SCM Queue shows Hold and Create PO stays available.
    hold: bool = False
    # When set, purchase only this distributor's OVF vendor lines (IN STOCK excluded).
    distributor_name: str | None = Field(default=None, max_length=255)
    # When set, these lines are purchased instead of raw OVF vendor_lines (qty/rate edits, removals).
    lines: list[ScmCreatePoFromOvfLineRequest] | None = None
    # Partial qty / remainder PO from item plan: always create a new draft (do not reuse).
    force_new: bool = False


class ScmInventoryPoLineRequest(BaseModel):
    product_name: str = Field(min_length=1, max_length=255)
    quantity: float = Field(gt=0)
    unit_cost: float = Field(ge=0, default=0)
    tax_rate: float = Field(ge=0, default=0)


class ScmCreateInventoryPoRequest(BaseModel):
    vendor_id: UUID
    entity_code: str
    document_date: date | None = None
    currency_code: str = "INR"
    payment_terms: str | None = None
    expected_delivery_date: date | None = None
    approved_by_name: str | None = Field(default=None, max_length=255)
    order_ref_cache: str | None = Field(default=None, max_length=100)
    lines: list[ScmInventoryPoLineRequest] = Field(default_factory=list)
    # Soft-delete these on-hand units when creating the PO (inventory deduction).
    stock_unit_ids: list[UUID] = Field(default_factory=list)
    import_line_ids: list[UUID] = Field(default_factory=list)


class ScmUpdateOvfChargesRequest(BaseModel):
    freight: float = 0
    additional_charges: float = 0
    finance_cost_pct: float = 0


class ScmNegotiationSubmitRequest(BaseModel):
    """Send the post-negotiation vendor price to Management for approval."""

    remark: str | None = Field(default=None, max_length=2000)


class ScmNegotiationDecisionRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    remark: str | None = Field(default=None, max_length=2000)


class ScmNegotiationResponse(BaseModel):
    order_id: UUID
    document_number: str
    company_po_number: str | None = None
    status: str
    baseline_amount: float
    negotiated_amount: float
    savings_amount: float
    savings_pct: float
    negotiation_status: str
    negotiation_remark: str | None = None
    negotiation_submitted_at: datetime | None = None
    negotiation_decided_at: datetime | None = None
    negotiation_decided_by_name: str | None = None
    can_issue: bool


class ScmFinalizeApprovalRequest(BaseModel):
    """Optional PO print PDF for Accept PO / Management approval emails."""

    po_pdf_base64: str | None = None
    po_pdf_filename: str | None = None
    remarks: str | None = None


class ScmFinalizeRequest(BaseModel):
    """Optional final (non-draft) PO PDF attached to the vendor issue email."""

    po_pdf_base64: str | None = None
    po_pdf_filename: str | None = None


class ScmFinalizeApprovalResponse(BaseModel):
    """Shared Approval inbox row for SCM Accept PO / Management finalize requests."""

    id: UUID
    kind: Literal["finalize"] = "finalize"
    order_id: UUID
    document_number: str
    company_po_number: str | None = None
    customer_name: str | None = None
    vendor_id: UUID
    vendor_name: str | None = None
    ovf_id: UUID | None = None
    ovf_no: str | None = None
    status: Literal["pending", "accepted", "rejected"]
    requested_at: datetime | None = None
    decided_at: datetime | None = None
    order_status: str
    workflow_status: str | None = None
    scm_approval_stage: Literal["accept_po", "management"] | None = None
    stage_label: str | None = None
    requested_by_id: UUID | None = None
    requested_by_name: str | None = None


class ProcApprovalStepOwnerUser(BaseModel):
    user_id: UUID
    display_name: str
    email: str


class ProcApprovalStepOwnersGroup(BaseModel):
    step_key: str
    label: str
    team_role: str
    owners: list[ProcApprovalStepOwnerUser]


class ProcApprovalStepOwnersReplaceRequest(BaseModel):
    user_ids: list[UUID] = Field(default_factory=list)


class ProcApprovalCapabilitiesResponse(BaseModel):
    is_module_admin: bool
    steps: list[str] = Field(default_factory=list)
    can_decide_approvals: bool


class ProcInvoiceGenerationTaskCreateRequest(BaseModel):
    order_id: UUID
    receipt_batch_id: UUID
    items_summary: str = ""
    vendor_name: str = ""
    customer_name: str = ""
    # Optional overrides for stock/partial billing (selected units, not whole GRN).
    grn_number: str = ""
    billing_quantity: float | None = Field(default=None, ge=0)
    billing_amount: float | None = Field(default=None, ge=0)


class ProcInvoiceGenerationTaskSubmitRequest(BaseModel):
    invoice_number: str = Field(min_length=1, max_length=80)
    invoice_date: date
    # Optional — server prefers SCM billing totals when present.
    invoice_quantity: float | None = Field(default=None, ge=0)
    invoice_amount: float | None = Field(default=None, ge=0)
    file_name: str | None = Field(default=None, max_length=255)
    content_base64: str | None = None
    content_type: str | None = Field(default=None, max_length=120)


class ProcInvoiceGenerationTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_code: str
    title: str
    status: str
    order_header_id: UUID
    receipt_batch_id: UUID
    grn_number: str = ""
    purchase_order_number: str = ""
    vendor_name: str = ""
    customer_name: str = ""
    items_summary: str = ""
    assigned_user_id: UUID
    company_id: UUID | None = None
    branch_id: UUID | None = None
    requested_by_id: UUID | None = None
    requested_by_name: str | None = None
    invoice_number: str | None = None
    invoice_date: date | None = None
    invoice_quantity: float | None = None
    invoice_amount: float | None = None
    # SCM billing GRN totals (auto-fetched for the Accounts form).
    suggested_quantity: float | None = None
    suggested_amount: float | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None


class OrderTrackingRequest(BaseModel):
    """Customer self-service lookup: their PO number + their registered email."""

    order_number: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=255)


class OrderTrackingMilestone(BaseModel):
    stage: str
    label: str
    done: bool
    on: date | None = None


class OrderTrackingResponse(BaseModel):
    """Milestone-level order status. Carries no commercial detail."""

    order_number: str | None = None
    customer_name: str | None = None
    order_date: date | None = None
    current_stage: str
    current_stage_label: str
    expected_delivery_date: date | None = None
    milestones: list[OrderTrackingMilestone] = Field(default_factory=list)


class ScmEtdUpdateRequest(BaseModel):
    """Record the delivery date the distributor confirmed."""

    expected_delivery_date: date | None = None
    notify_customer: bool = True


class ScmDeliveryContactResponse(BaseModel):
    """Customer email for Delivery Tracking (CRM default, editable on send)."""

    order_id: UUID
    email: str | None = None
    crm_email: str | None = None
    customer_name: str | None = None
    customer_ack_sent_at: datetime | None = None


class ScmDummyDeliverySendRequest(BaseModel):
    """Send order acknowledgement to the customer over SMTP."""

    email: str | None = Field(default=None, max_length=255)
    # Persist ETD in the same request so Send saves date + emails once.
    expected_delivery_date: date | None = None


class ScmDummyDeliverySendResponse(BaseModel):
    order_id: UUID
    email: str
    customer_ack_sent_at: datetime
    dummy: bool = False
    etd: str | None = None
    message: str


class ScmDeliveryMilestoneRequest(BaseModel):
    milestone: str = Field(max_length=40)
    awb_number: str | None = Field(default=None, max_length=100)
    actual_delivery_date: date | None = None
    note: str | None = None


class ScmDeliveryMilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    delivery_milestone: str | None = None
    delivery_milestone_history: list[dict] | None = None
    awb_number: str | None = None
    expected_delivery_date: date | None = None
    actual_delivery_date: date | None = None


class ScmFulfillmentLineState(BaseModel):
    order_line_id: UUID
    line_number: int | None = None
    product_name: str | None = None
    product_code: str | None = None
    ordered_qty: float = 0
    dispatched_qty: float = 0
    remaining_to_dispatch: float = 0
    received_qty: float = 0
    grn_cap_qty: float = 0


class ScmVendorDispatchLineResponse(BaseModel):
    id: UUID
    order_line_id: UUID
    dispatch_qty: float
    grn_received_qty: float = 0
    grn_remaining_qty: float = 0


class ScmVendorDispatchResponse(BaseModel):
    id: UUID
    order_header_id: UUID
    sequence: int
    dc_number: str | None = None
    invoice_number: str | None = None
    lr_awb_number: str | None = None
    dispatch_date: date | None = None
    eway_notes: str | None = None
    transport_notes: str | None = None
    attachment_refs: dict | list | None = None
    status: str
    grn_status: str = "pending"  # pending | partial | done
    grn_received_qty: float = 0
    grn_dispatch_qty: float = 0
    grn_numbers: list[str] = Field(default_factory=list)
    created_at: datetime | None = None
    lines: list[ScmVendorDispatchLineResponse] = Field(default_factory=list)


class ScmFulfillmentStateResponse(BaseModel):
    order_id: UUID
    fulfillment_stage: str | None = None
    vendor_response_status: str = "pending"
    vendor_response_remark: str | None = None
    vendor_responded_at: datetime | None = None
    expected_delivery_date: date | None = None
    customer_promised_delivery_date: date | None = None
    po_sent_to_vendor_at: datetime | None = None
    customer_order_processed_sent_at: datetime | None = None
    customer_dispatch_shared_at: datetime | None = None
    customer_pod_uploaded_at: datetime | None = None
    customer_delivery_meta: dict = Field(default_factory=dict)
    grn_unlocked: bool = False
    vendor_email: str | None = None
    vendor_name: str | None = None
    customer_email: str | None = None
    customer_name: str | None = None
    lines: list[ScmFulfillmentLineState] = Field(default_factory=list)
    dispatches: list[ScmVendorDispatchResponse] = Field(default_factory=list)


class ScmFulfillmentSendToVendorRequest(BaseModel):
    email: str | None = Field(default=None, max_length=255)
    po_pdf_base64: str | None = None
    po_pdf_filename: str | None = Field(default=None, max_length=255)


class ScmFulfillmentVendorResponseRequest(BaseModel):
    status: Literal["accepted", "rejected"]
    remark: str | None = Field(default=None, max_length=2000)
    # Set/override vendor EDD when accepting (manual entry on fulfillment panel).
    expected_delivery_date: date | None = None


class ScmFulfillmentCustomerMailRequest(BaseModel):
    email: str | None = Field(default=None, max_length=255)


class ScmVendorDispatchLineCreate(BaseModel):
    order_line_id: UUID
    dispatch_qty: float = Field(gt=0)


class ScmVendorDispatchCreateRequest(BaseModel):
    dc_number: str | None = Field(default=None, max_length=80)
    invoice_number: str | None = Field(default=None, max_length=80)
    lr_awb_number: str | None = Field(default=None, max_length=100)
    dispatch_date: date | None = None
    eway_notes: str | None = None
    transport_notes: str | None = None
    attachment_refs: dict | list | None = None
    lines: list[ScmVendorDispatchLineCreate] = Field(min_length=1)


class ScmCustomerDeliveryUpsertRequest(BaseModel):
    delivery_address: str | None = None
    contact_name: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=40)
    delivery_date: date | None = None
    delivery_time: str | None = Field(default=None, max_length=40)
    instructions: str | None = None
    doc_tax_invoice: bool | None = None
    doc_delivery_challan: bool | None = None
    doc_eway: bool | None = None
    doc_packing_list: bool | None = None
    transporter_name: str | None = Field(default=None, max_length=255)
    lr_awb: str | None = Field(default=None, max_length=100)
    invoice_number: str | None = Field(default=None, max_length=80)
    dc_number: str | None = Field(default=None, max_length=80)
    customer_edd: date | None = None
    mark_ready: bool = False


class ScmCustomerPodUploadRequest(BaseModel):
    pod_file_name: str | None = Field(default=None, max_length=255)
    pod_content_base64: str | None = None
    note: str | None = Field(default=None, max_length=2000)


class InventoryUnitRow(BaseModel):
    kind: str
    id: UUID
    product_name: str | None = None
    serial_number: str | None = None
    received_on: date | None = None
    quantity: Decimal
    unit_cost: Decimal
    warranty_valid_till: date | None = None
    warranty_expired: bool = False
    warranty_days_left: int | None = None
    owner_employee_id: UUID | None = None
    owner_name: str | None = None
    source_ovf_id: UUID | None = None
    open_for_sale: bool = False
    status: str
    age_days: int
    aging_bucket: str
    holding_cost: Decimal
    current_value: Decimal


class InventoryAgingTotals(BaseModel):
    units: Decimal
    value: Decimal
    holding_cost: Decimal


class InventoryAgingBucket(InventoryAgingTotals):
    bucket: str


class InventoryAgingOwnerRow(InventoryAgingTotals):
    owner_employee_id: UUID | None = None
    owner_name: str | None = None
    oldest_age_days: int = 0


class InventoryAgingProductRow(InventoryAgingTotals):
    product_name: str | None = None


class InventoryAgingReport(BaseModel):
    as_of: date
    target_max_age_days: int
    total: InventoryAgingTotals
    over_target: InventoryAgingTotals
    warranty_expired_units: int
    buckets: list[InventoryAgingBucket]
    by_owner: list[InventoryAgingOwnerRow]
    by_product: list[InventoryAgingProductRow]


class InventorySelectionRequest(BaseModel):
    stock_unit_ids: list[UUID] = Field(default_factory=list)
    import_line_ids: list[UUID] = Field(default_factory=list)


class InventoryAssignOwnerRequest(InventorySelectionRequest):
    owner_employee_id: UUID | None = None


class InventoryOpenForSaleRequest(InventorySelectionRequest):
    open_for_sale: bool = True


class InventoryTransferCreate(InventorySelectionRequest):
    customer_note: str | None = None


class InventoryTransferDecision(BaseModel):
    accept: bool
    remark: str | None = None


class InventoryTransferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    requester_employee_id: UUID
    owner_employee_id: UUID | None = None
    product_name: str
    quantity: Decimal
    stock_unit_ids: list[str] | None = None
    import_line_ids: list[str] | None = None
    customer_note: str | None = None
    status: str
    decided_at: datetime | None = None
    decision_remark: str | None = None
    created_at: datetime | None = None


class ServiceRateContractCreate(BaseModel):
    vendor_name: str = Field(min_length=1, max_length=255)
    vendor_id: UUID | None = None
    service_type: str = Field(max_length=30)
    region: str | None = Field(default=None, max_length=120)
    rate_per_visit: Decimal = Field(gt=0)
    valid_from: date
    valid_to: date | None = None
    remarks: str | None = None


class ServiceRateContractUpdate(BaseModel):
    vendor_name: str | None = Field(default=None, max_length=255)
    service_type: str | None = Field(default=None, max_length=30)
    region: str | None = Field(default=None, max_length=120)
    rate_per_visit: Decimal | None = Field(default=None, gt=0)
    valid_from: date | None = None
    valid_to: date | None = None
    status: str | None = None
    remarks: str | None = None


class ServiceRateContractResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_code: str
    vendor_id: UUID | None = None
    vendor_name: str
    service_type: str
    region: str | None = None
    rate_per_visit: Decimal
    valid_from: date
    valid_to: date | None = None
    status: str
    remarks: str | None = None
    created_at: datetime | None = None


class ServicePlanCreate(BaseModel):
    ovf_id: UUID
    rate_contract_id: UUID
    projected_visits: int = Field(gt=0, le=100000)
    consumables_amount: Decimal = Field(default=Decimal("0"), ge=0)
    description: str | None = None
    add_to_ovf: bool = True


class ServicePlanResponse(BaseModel):
    id: UUID
    ovf_id: UUID
    rate_contract_id: UUID
    contract_code: str | None = None
    vendor_name: str | None = None
    service_type: str | None = None
    description: str | None = None
    projected_visits: int
    visits_done: int
    visits_remaining: int
    extra_visits: int
    rate_per_visit: Decimal
    consumables_amount: Decimal
    planned_total: Decimal
    actual_cost: Decimal
    added_to_ovf: bool
    status: str


class ServiceVisitCreate(BaseModel):
    visit_date: date
    site: str | None = Field(default=None, max_length=255)
    engineer_name: str | None = Field(default=None, max_length=255)
    remarks: str | None = None


class ServiceVisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID
    visit_date: date
    site: str | None = None
    engineer_name: str | None = None
    remarks: str | None = None
    status: str
    beyond_projection: bool
    expense_id: UUID | None = None
    created_at: datetime | None = None


class DeliveryProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    opportunity_id: UUID | None = None
    company_account_id: UUID | None = None
    customer_name: str | None = Field(default=None, max_length=255)
    remarks: str | None = None


class DeliveryProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    customer_name: str | None = Field(default=None, max_length=255)
    remarks: str | None = None
    status: str | None = None
    public_tracking_enabled: bool | None = None
    rotate_tracking_token: bool = False


class DeliverySiteInput(BaseModel):
    circle: str | None = Field(default=None, max_length=120)
    site_code: str | None = Field(default=None, max_length=80)
    site_name: str | None = Field(default=None, max_length=255)
    address: str | None = None
    state: str | None = Field(default=None, max_length=100)
    gstin: str | None = Field(default=None, max_length=15)
    customer_po_number: str | None = Field(default=None, max_length=100)
    item_summary: str | None = None
    quantity: Decimal | None = None
    milestone: str | None = Field(default=None, max_length=40)
    status: str | None = Field(default=None, max_length=20)
    expected_delivery_date: date | None = None
    actual_delivery_date: date | None = None
    awb_number: str | None = Field(default=None, max_length=100)
    delay_reason: str | None = None
    last_note: str | None = None
    ovf_id: UUID | None = None
    order_header_id: UUID | None = None


class DeliverySiteResponse(BaseModel):
    id: UUID
    project_id: UUID
    circle: str | None = None
    site_code: str | None = None
    site_name: str
    address: str | None = None
    state: str | None = None
    gstin: str | None = None
    customer_po_number: str | None = None
    ovf_id: UUID | None = None
    order_header_id: UUID | None = None
    item_summary: str | None = None
    quantity: Decimal | None = None
    milestone: str
    milestone_label: str
    status: str
    expected_delivery_date: date | None = None
    actual_delivery_date: date | None = None
    awb_number: str | None = None
    delay_reason: str | None = None
    last_note: str | None = None
    delayed: bool = False
    history: list[dict] = Field(default_factory=list)
    updated_at: datetime | None = None


class DeliveryProjectResponse(BaseModel):
    id: UUID
    project_code: str
    name: str
    company_account_id: UUID | None = None
    customer_name: str | None = None
    opportunity_id: UUID | None = None
    tracking_token: str
    public_tracking_enabled: bool
    status: str
    remarks: str | None = None
    created_at: datetime | None = None
    site_count: int = 0
    delivered_count: int = 0
    installed_count: int = 0
    delayed_count: int = 0
    on_hold_count: int = 0
    by_milestone: dict[str, int] = Field(default_factory=dict)
    circles: list[str] = Field(default_factory=list)


class DeliveryProjectDetailResponse(DeliveryProjectResponse):
    sites: list[DeliverySiteResponse] = Field(default_factory=list)


class DeliveryTrackerImportRequest(BaseModel):
    content_base64: str = Field(min_length=1)


class DeliveryTrackerImportResponse(BaseModel):
    updated: int
    created: int
    unchanged: int
    errors: list[dict] = Field(default_factory=list)


class PublicTrackerSite(BaseModel):
    circle: str | None = None
    site_code: str | None = None
    site_name: str
    customer_po_number: str | None = None
    milestone: str
    milestone_label: str
    milestone_step: int
    milestone_steps: int
    status: str
    expected_delivery_date: date | None = None
    actual_delivery_date: date | None = None
    awb_number: str | None = None
    delayed: bool = False
    updated_at: datetime | None = None


class PublicTrackerResponse(BaseModel):
    project_code: str
    name: str
    customer_name: str | None = None
    status: str
    site_count: int
    delivered_count: int
    installed_count: int
    delayed_count: int
    on_hold_count: int
    by_milestone: dict[str, int] = Field(default_factory=dict)
    circles: list[str] = Field(default_factory=list)
    sites: list[PublicTrackerSite] = Field(default_factory=list)


class ScmEtdUpdateResponse(BaseModel):
    order_id: UUID
    expected_delivery_date: date | None = None
    etd_confirmed_at: datetime | None = None
    customer_notified: bool = False


class ScmDeliveryNotificationRunResponse(BaseModel):
    """Counts from one pass of the automated order/delivery correspondence."""

    acknowledged: int = 0
    etd_chased: int = 0
    delivery_dates_shared: int = 0


class ScmCorrespondenceDeliveryResponse(BaseModel):
    id: str
    event_id: str
    channel: str
    attempt_no: int
    status: str
    provider_response: str | None = None
    delivered_at: str | None = None
    event_type: str | None = None
    recipient_address: str | None = None
    event_status: str | None = None
    created_at: str | None = None
    subject: str | None = None
    order_id: str | None = None
    company_po_number: str | None = None
    kind: str | None = None


class ScmCorrespondenceTemplateResponse(BaseModel):
    kind: str
    scope: str
    company_account_id: str | None = None
    audience: str
    template_code: str
    template_name: str
    subject_template: str | None = None
    body_template: str
    is_override: bool = False
    inherits_default: bool = False
    placeholders: list[str] = Field(default_factory=list)


class ScmCorrespondenceTemplateUpsertRequest(BaseModel):
    kind: str = Field(min_length=1, max_length=50)
    subject_template: str = Field(min_length=1)
    body_template: str = Field(min_length=1)
    company_account_id: UUID | None = None


class ScmItemPlanVendorUpdateRequest(BaseModel):
    """Update distributor_name on a CRM OVF vendor line from SCM item plan."""

    product_name: str = Field(min_length=1, max_length=255)
    line_index: int = Field(ge=0)
    distributor_name: str = Field(min_length=1, max_length=255)


class ScmLineReceiptUpdateRequest(BaseModel):
    quantity_received: float
    grn_status: str | None = None  # pending | partial | delivered
    # One value per unit received in this save (use "NA" when not tracked).
    serial_numbers: list[str] | None = None
    billing: bool = True
    billing_quantity: float | None = None
    delivery_challan_quantity: float | None = None
    # When set, this receipt belongs to a specific vendor dispatch wave.
    vendor_dispatch_id: UUID | None = None

    @field_validator("serial_numbers", mode="before")
    @classmethod
    def validate_serial_numbers(cls, value: object) -> list[str] | None:
        from shared.text_safety import sanitize_plain_text_list

        if value is None:
            return None
        if not isinstance(value, list):
            return None
        return sanitize_plain_text_list(
            [str(item) for item in value],
            field="serial_numbers",
        )

class ScmVendorPoLineResponse(BaseModel):
    id: UUID
    line_number: int
    product_name: str | None = None
    quantity: float
    quantity_received: float
    last_receipt_qty: float = 0
    last_receipt_batch_id: UUID | None = None
    last_receipt_serial_numbers: list[str] | None = None
    last_receipt_billing: bool = True
    last_receipt_billing_quantity: float = 0
    last_receipt_delivery_challan_quantity: float = 0
    unit_cost: float
    rate_currency: str = "INR"
    line_total: float
    status: str
    grn_status: str


class ScmVendorPoResponse(BaseModel):
    id: UUID
    document_number: str
    document_date: date
    created_at: datetime | None = None
    vendor_id: UUID
    status: str
    currency_code: str
    total_amount: float
    source_module: str | None = None
    source_document_type: str | None = None
    source_document_id: UUID | None = None
    company_po_number: str | None = None
    customer_name: str | None = None
    customer_po_number: str | None = None
    vendor_total: float = 0
    customer_total: float = 0
    margin_amount: float = 0
    grn_status: str
    baseline_amount: float = 0
    negotiated_savings_amount: float = 0
    negotiation_status: str = "not_required"
    negotiation_decided_by_name: str | None = None
    receipt_saved_at: datetime | None = None
    current_receipt_batch_id: UUID | None = None
    current_grn_number: str | None = None
    grn_sequence: int = 0
    line_count: int = 0
    lines: list[ScmVendorPoLineResponse] = Field(default_factory=list)


class ScmReceiptBatchLineResponse(BaseModel):
    order_line_id: UUID
    line_number: int
    product_name: str | None = None
    quantity: float
    serial_numbers: list[str] | None = None
    billing: bool = True
    billing_quantity: float = 0
    delivery_challan_quantity: float = 0

    @field_validator("serial_numbers", mode="before")
    @classmethod
    def coerce_serial_numbers(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        if not isinstance(value, list):
            return None
        out: list[str] = []
        for item in value:
            text = str(item).strip()
            if text:
                out.append(text)
        return out or None


class ScmProcurementInventoryRowResponse(BaseModel):
    order_id: UUID | None = None
    order_line_id: UUID | None = None
    receipt_batch_id: UUID | None = None
    grn_number: str
    receipt_at: datetime | None = None
    company_po_number: str
    vendor_id: UUID | None = None
    product_name: str | None = None
    line_number: int = 0
    unit_index: int
    serial_number: str
    source: str = "grn"
    received_quantity: float = 0
    billing_quantity: float = 0
    unit_cost: float = 0
    description: str | None = None
    stock_unit_id: UUID | None = None
    import_line_id: UUID | None = None
    warranty_valid_till: date | None = None
    owner_employee_id: UUID | None = None
    source_ovf_id: UUID | None = None
    open_for_sale: bool = False


class ScmInventoryImportLineRequest(BaseModel):
    product_name: str
    serial_number: str
    description: str | None = None
    order_id: UUID | None = None
    warranty_valid_till: date | None = None
    unit_cost: float | None = Field(default=None, ge=0)
    received_on: date | None = None
    owner_employee_id: UUID | None = None

    @field_validator("serial_number", "product_name")
    @classmethod
    def reject_markup(cls, value: str) -> str:
        from shared.text_safety import assert_safe_plain_text

        return assert_safe_plain_text(value, field="value")

    @field_validator("description")
    @classmethod
    def reject_description_markup(cls, value: str | None) -> str | None:
        if value is None:
            return None
        from shared.text_safety import assert_safe_plain_text

        return assert_safe_plain_text(value, field="description")


class ScmInventoryImportRequest(BaseModel):
    lines: list[ScmInventoryImportLineRequest] = Field(default_factory=list)


class ScmInventorySerialUpdate(BaseModel):
    serial_number: str = Field(..., min_length=1, max_length=120)

    @field_validator("serial_number")
    @classmethod
    def reject_serial_markup(cls, value: str) -> str:
        from shared.text_safety import assert_safe_plain_text

        return assert_safe_plain_text(value, field="serial_number")


class ScmInventoryConsumeUnitsRequest(BaseModel):
    """Soft-delete on-hand GRN stock units after billing / delivery challan selection."""

    stock_unit_ids: list[UUID] = Field(..., min_length=1)
    company_id: UUID | None = None


class ScmInventoryDescriptionUpdate(BaseModel):
    description: str = Field(..., max_length=50)


class ScmReceiptBatchAttachmentSummary(BaseModel):
    id: UUID
    file_name: str
    content_type: str | None = None
    size: int | None = None
    category: str | None = None


class ScmCommercialAttachmentSummary(BaseModel):
    """OVF / purchase-order commercial documents visible to SCM and approvers."""

    id: UUID
    file_name: str
    content_type: str | None = None
    size: int | None = None
    category: str = "other"
    remarks: str | None = None
    entity_type: str
    entity_id: UUID
    source: str = "upload"
    external_url: str | None = None


class ScmCommercialAttachmentCreate(BaseModel):
    file_name: str
    content_base64: str
    content_type: str | None = None
    branch_id: UUID
    company_id: UUID | None = None
    category: str = "other"
    remarks: str | None = Field(default=None, max_length=2000)


class ScmReceiptBatchResponse(BaseModel):
    id: UUID | None = None
    sequence: int
    grn_number: str
    receipt_at: datetime | None = None
    created_by: UUID | None = None
    created_by_name: str | None = None
    vendor_dispatch_id: UUID | None = None
    vendor_dispatch_sequence: int | None = None
    vendor_invoice_number: str | None = None
    vendor_invoice_date: date | None = None
    vendor_invoice_quantity: float | None = None
    vendor_invoice_subtotal: float | None = None
    reversed: bool = False
    reversal_status: str = "posted"
    reversed_at: datetime | None = None
    reversed_by: UUID | None = None
    reversal_reason: str | None = None
    lines: list[ScmReceiptBatchLineResponse] = Field(default_factory=list)
    attachments: list[ScmReceiptBatchAttachmentSummary] = Field(default_factory=list)


class ScmVendorInvoiceExtractRequest(BaseModel):
    file_name: str = Field(..., min_length=1, max_length=255)
    content_base64: str = Field(..., min_length=1)


class ScmVendorInvoiceExtractResponse(BaseModel):
    vendor_invoice_number: str | None = None
    vendor_invoice_date: date | None = None
    vendor_invoice_quantity: float | None = None
    vendor_invoice_subtotal: float | None = None


class ScmReceiptBatchVendorInvoiceUpdate(BaseModel):
    vendor_invoice_number: str | None = Field(None, max_length=80)
    vendor_invoice_date: date | None = None
    vendor_invoice_quantity: float | None = None
    vendor_invoice_subtotal: float | None = None
    file_name: str | None = Field(None, max_length=255)
    content_base64: str | None = None
    content_type: str | None = None
    branch_id: UUID
    company_id: UUID | None = None


class ScmReceiptBatchAttachmentCreate(BaseModel):
    file_name: str
    content_base64: str
    content_type: str | None = None
    branch_id: UUID
    company_id: UUID | None = None


class ScmReceiptBatchReverseRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)


# --- GRN ---


class GrnCreateRequest(BaseModel):
    order_header_id: UUID
    document_date: date
    warehouse_reference: UUID
    notes: str | None = None
    company_id: UUID | None = None


class GrnLineCreateRequest(BaseModel):
    order_line_id: UUID
    line_number: int
    quantity: float
    quantity_rejected: float = 0


class GrnLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_line_id: UUID
    line_number: int
    product_id: UUID
    quantity: float
    quantity_rejected: float
    status: str


class GrnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    order_header_id: UUID
    vendor_id: UUID
    warehouse_reference: UUID
    status: str
    subtotal_amount: float
    version: int
    lines: list[GrnLineResponse] = Field(default_factory=list)


# --- Invoice ---


class InvoiceCreateRequest(BaseModel):
    grn_header_id: UUID
    document_date: date
    due_date: date
    vendor_invoice_number: str
    period_id: UUID | None = None
    company_id: UUID | None = None


class InvoiceUpdateRequest(BaseModel):
    due_date: date | None = None
    vendor_invoice_number: str | None = None
    version: int | None = None


class InvoiceLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    line_number: int
    product_id: UUID
    product_code: str | None = None
    quantity: float
    unit_cost: float
    tax_amount: float
    line_total: float
    expense_account_id: UUID | None = None


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    due_date: date
    vendor_id: UUID
    vendor_invoice_number: str
    order_header_id: UUID | None = None
    grn_header_id: UUID | None = None
    total_amount: float
    balance_due: float
    match_status: str
    status: str
    workflow_status: str | None = None
    finance_ledger_id: UUID | None = None
    finance_journal_id: UUID | None = None
    posting_status: str | None = None
    version: int
    lines: list[InvoiceLineResponse] = Field(default_factory=list)


class InvoicePostRequest(BaseModel):
    ap_account_id: UUID
    expense_account_id: UUID | None = None


# --- Return ---


class ReturnCreateRequest(BaseModel):
    branch_id: UUID
    document_date: date
    vendor_id: UUID
    invoice_header_id: UUID
    currency_code: str
    order_header_id: UUID | None = None
    grn_header_id: UUID | None = None
    period_id: UUID | None = None
    exchange_rate: float = 1.0
    reason_code: str | None = None
    company_id: UUID | None = None


class ReturnLineCreateRequest(BaseModel):
    line_number: int
    product_id: UUID
    quantity: float
    unit_cost: float
    invoice_line_id: UUID | None = None
    order_line_id: UUID | None = None
    grn_line_id: UUID | None = None
    tax_amount: float = 0


class ReturnLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    line_number: int
    product_id: UUID
    quantity: float
    unit_cost: float
    tax_amount: float
    line_total: float
    status: str


class ReturnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str
    document_date: date
    vendor_id: UUID
    invoice_header_id: UUID
    order_header_id: UUID | None = None
    grn_header_id: UUID | None = None
    reason_code: str | None = None
    total_amount: float
    status: str
    workflow_status: str | None = None
    finance_journal_id: UUID | None = None
    version: int
    lines: list[ReturnLineResponse] = Field(default_factory=list)


class ReturnPostRequest(BaseModel):
    ap_account_id: UUID
    expense_account_id: UUID


# --- Contract ---


class ContractCreateRequest(BaseModel):
    vendor_id: UUID
    contract_name: str
    start_date: date
    end_date: date
    currency_code: str
    contract_value: float | None = None
    branch_id: UUID | None = None
    company_id: UUID | None = None


class ContractUpdateRequest(BaseModel):
    contract_name: str | None = None
    end_date: date | None = None
    contract_value: float | None = None
    version: int | None = None


class ContractLineCreateRequest(BaseModel):
    line_number: int
    product_id: UUID | None = None
    unit_cost: float
    min_quantity: float | None = None
    max_quantity: float | None = None
    effective_from: date | None = None
    effective_to: date | None = None


class ContractLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    line_number: int
    product_id: UUID | None = None
    unit_cost: float
    min_quantity: float | None = None
    max_quantity: float | None = None
    status: str


class ContractResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID | None = None
    document_number: str
    vendor_id: UUID
    contract_name: str
    start_date: date
    end_date: date
    contract_value: float | None = None
    currency_code: str
    status: str
    workflow_status: str | None = None
    workflow_instance_id: UUID | None = None
    version: int
    lines: list[ContractLineResponse] = Field(default_factory=list)


# --- Vendor comparison ---


class ComparisonSelectRequest(BaseModel):
    quotation_id: UUID


class ComparisonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID
    document_number: str | None = None
    rfq_header_id: UUID
    best_price_quotation_id: UUID | None = None
    best_delivery_quotation_id: UUID | None = None
    best_overall_quotation_id: UUID | None = None
    selected_quotation_id: UUID | None = None
    score_breakdown: dict | None = None
    status: str
    compared_at: datetime | None = None


# --- Performance ---


class PerformanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID | None = None
    vendor_id: UUID
    period_code: str
    on_time_delivery_pct: float | None = None
    quality_rating: float | None = None
    cost_competitiveness_score: float | None = None
    contract_compliance_score: float | None = None
    issue_resolution_days: float | None = None
    overall_score: float
    calculated_at: datetime
    status: str


# --- OVF timeline (Insight) ---


class OvfTimelineListItemResponse(BaseModel):
    ovf_id: UUID
    ovf_no: str
    customer_name: str | None = None
    quote_name: str | None = None
    account_name: str | None = None
    blueprint_state: str | None = None
    shared_to_scm: bool = False
    deal_won: bool = False
    timeline_status: str
    updated_at: datetime | None = None
    shared_to_scm_at: datetime | None = None
    company_po_numbers: list[str] = Field(default_factory=list)


class OvfTimelineEventResponse(BaseModel):
    id: str
    occurred_at: datetime
    event_type: str
    entity_type: str
    entity_id: UUID
    entity_label: str | None = None
    title: str
    summary: str | None = None
    action: str | None = None
    from_state: str | None = None
    to_state: str | None = None
    actor_id: UUID | None = None
    actor_name: str | None = None
    requested_by_id: UUID | None = None
    requested_by_name: str | None = None
    decided_by_id: UUID | None = None
    decided_by_name: str | None = None
    decision: str | None = None
    team_role: str | None = None
    remark: str | None = None
    version: int | None = None


class OvfTimelineResponse(BaseModel):
    ovf_id: UUID
    ovf_no: str
    customer_name: str | None = None
    quote_name: str | None = None
    timeline_status: str
    blueprint_state: str | None = None
    linked_order_ids: list[UUID] = Field(default_factory=list)
    events: list[OvfTimelineEventResponse]


class OvfTimelineEventRecordRequest(BaseModel):
    action: str
    title: str
    summary: str | None = None
    entity_label: str | None = None
    occurred_at: datetime | None = None
    metadata: dict | None = None


# --- Shared ---


class WorkflowActionRequest(BaseModel):
    comments: str | None = None


# --- Excel sheet trackers (workspace tab) ---


class SheetTrackerColumn(BaseModel):
    id: str
    label: str


class SheetTrackerMergeInfo(BaseModel):
    added_columns: list[str] = Field(default_factory=list)
    added_rows: int = 0
    updated_rows: int = 0
    file_name: str | None = None


class SheetTrackerSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    last_file_name: str | None = None
    column_count: int
    row_count: int
    last_upload_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    version: int
    last_merge: SheetTrackerMergeInfo | None = None


class SheetTrackerDetailResponse(SheetTrackerSummaryResponse):
    columns: list[SheetTrackerColumn] = Field(default_factory=list)
    rows: list[dict[str, str]] = Field(default_factory=list)


class SheetTrackerUploadRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=180)
    content_base64: str = Field(min_length=1)
    content_type: str | None = None
    tracker_id: UUID | None = None
    name: str | None = Field(default=None, max_length=180)
