"""Procurement Pydantic schemas."""

from datetime import date, datetime
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
    total_amount: float
    received_amount: float = 0
    status: str
    workflow_status: str | None = None
    source_module: str | None = None
    source_document_type: str | None = None
    source_document_id: UUID | None = None
    company_po_number: str | None = None
    entity_code: str | None = None
    customer_name: str | None = None
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
    purchase_orders: list[ScmLinkedPurchaseOrder] = Field(default_factory=list)
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
    purchase_orders: list[ScmLinkedPurchaseOrder] = Field(default_factory=list)
    scm_on_hold: bool = False
    scm_on_hold_at: datetime | None = None
    scm_hold_blocked: bool = False
    scm_last_hold_since: datetime | None = None
    scm_last_hold_released_at: datetime | None = None
    scm_hold_history: list[ScmOvfHoldHistoryEntry] = Field(default_factory=list)
    scm_on_hold_remark: str | None = None
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


class ScmInventoryPoLineRequest(BaseModel):
    product_name: str = Field(min_length=1, max_length=255)
    quantity: float = Field(gt=0)
    unit_cost: float = Field(ge=0, default=0)


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


class ScmLineReceiptUpdateRequest(BaseModel):
    quantity_received: float
    grn_status: str | None = None  # pending | partial | delivered
    # One value per unit received in this save (use "NA" when not tracked).
    serial_numbers: list[str] | None = None
    billing: bool = True
    billing_quantity: float | None = None
    delivery_challan_quantity: float | None = None


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
    vendor_total: float = 0
    customer_total: float = 0
    margin_amount: float = 0
    grn_status: str
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


class ScmInventoryImportLineRequest(BaseModel):
    product_name: str
    serial_number: str
    description: str | None = None
    order_id: UUID | None = None


class ScmInventoryImportRequest(BaseModel):
    lines: list[ScmInventoryImportLineRequest] = Field(default_factory=list)


class ScmInventorySerialUpdate(BaseModel):
    serial_number: str = Field(..., min_length=1, max_length=120)


class ScmInventoryDescriptionUpdate(BaseModel):
    description: str = Field(..., max_length=50)


class ScmReceiptBatchAttachmentSummary(BaseModel):
    id: UUID
    file_name: str
    content_type: str | None = None
    size: int | None = None


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


# --- Shared ---


class WorkflowActionRequest(BaseModel):
    comments: str | None = None
