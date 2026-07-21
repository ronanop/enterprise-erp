"""E-Commerce Pydantic schemas."""

from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class StoreCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class StoreUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class StoreResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    store_number: str
    store_code: str
    store_name: str
    store_type: str
    default_currency: str
    timezone: str | None
    owner_employee_id: UUID
    department_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class SalesChannelCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SalesChannelUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SalesChannelResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    channel_number: str
    channel_code: str
    channel_name: str
    store_id: UUID
    channel_type: str
    external_channel_ref: str | None
    is_active: bool
    config_json: dict | None
    status: str
    company_id: UUID
    version: int

class ProductListingCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ProductListingUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ProductListingResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    listing_number: str
    sales_channel_id: UUID
    product_id: UUID
    external_sku: str | None
    external_listing_id: str | None
    title: str
    description: str | None
    attributes_json: dict | None
    published_by_employee_id: UUID | None
    published_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class ListingPriceCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ListingPriceUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ListingPriceResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    product_listing_id: UUID
    price_type: str
    currency: str
    list_price: Decimal
    sale_price: Decimal | None
    effective_from: datetime | None
    effective_to: datetime | None
    promotion_id: UUID | None
    status: str
    company_id: UUID
    version: int

class ListingInventoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ListingInventoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ListingInventoryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    product_listing_id: UUID
    warehouse_id: UUID | None
    available_qty: Decimal
    reserved_qty: Decimal
    safety_stock_qty: Decimal
    last_synced_at: datetime | None
    inventory_item_ref_id: UUID | None
    sync_status: str
    status: str
    company_id: UUID
    version: int

class CustomerCartCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class CustomerCartUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class CustomerCartResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    cart_number: str
    sales_channel_id: UUID
    customer_id: UUID
    currency: str
    coupon_id: UUID | None
    expires_at: datetime | None
    converted_order_id: UUID | None
    status: str
    company_id: UUID
    version: int

class CartItemCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class CartItemUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class CartItemResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    cart_id: UUID
    product_listing_id: UUID
    product_id: UUID
    quantity: Decimal
    unit_price: Decimal
    line_amount: Decimal
    status: str
    company_id: UUID
    version: int

class OrderCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class OrderUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class OrderResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    order_number: str
    sales_channel_id: UUID
    store_id: UUID
    customer_id: UUID
    cart_id: UUID | None
    coupon_id: UUID | None
    external_order_ref: str | None
    currency: str
    subtotal_amount: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    shipping_amount: Decimal
    grand_total: Decimal
    shipping_address_json: dict | None
    billing_address_json: dict | None
    sales_order_id: UUID | None
    placed_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class OrderItemCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class OrderItemUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class OrderItemResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    order_id: UUID
    line_no: int
    product_listing_id: UUID
    product_id: UUID
    external_line_ref: str | None
    quantity: Decimal
    unit_price: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    line_total: Decimal
    sales_order_line_id: UUID | None
    status: str
    company_id: UUID
    version: int

class PaymentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PaymentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PaymentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    payment_number: str
    order_id: UUID
    payment_method: str
    currency: str
    amount: Decimal
    gateway_code: str | None
    gateway_payment_ref: str | None
    captured_at: datetime | None
    finance_journal_id: UUID | None
    status: str
    company_id: UUID
    version: int

class PaymentTransactionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PaymentTransactionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PaymentTransactionResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    payment_id: UUID
    transaction_type: str
    amount: Decimal
    gateway_txn_ref: str | None
    occurred_at: datetime | None
    raw_payload_json: dict | None
    finance_journal_id: UUID | None
    status: str
    company_id: UUID
    version: int

class ShipmentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ShipmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ShipmentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    shipment_number: str
    order_id: UUID
    carrier_code: str
    tracking_number: str | None
    shipped_at: datetime | None
    delivered_at: datetime | None
    shipping_label_uri: str | None
    sales_delivery_id: UUID | None
    status: str
    company_id: UUID
    version: int

class ShippingTrackingCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ShippingTrackingUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ShippingTrackingResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    shipment_id: UUID
    tracked_at: datetime | None
    tracking_status: str
    location_text: str | None
    carrier_event_code: str | None
    payload_json: dict | None
    status: str
    company_id: UUID
    version: int

class ReturnRequestCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReturnRequestUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReturnRequestResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    return_number: str
    order_id: UUID
    customer_id: UUID
    reason_code: str
    requested_at: datetime | None
    refund_payment_id: UUID | None
    sales_return_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class ReturnItemCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReturnItemUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReturnItemResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    return_request_id: UUID
    order_item_id: UUID
    product_id: UUID
    quantity: Decimal
    condition_code: str
    refund_amount: Decimal
    status: str
    company_id: UUID
    version: int

class CouponCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class CouponUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class CouponResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    coupon_number: str
    store_id: UUID
    coupon_code: str
    discount_type: str
    discount_value: Decimal
    max_redemptions: int | None
    redeemed_count: int
    valid_from: datetime | None
    valid_to: datetime | None
    status: str
    company_id: UUID
    version: int

class PromotionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PromotionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PromotionResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    promotion_number: str
    store_id: UUID
    promotion_code: str
    promotion_name: str
    promotion_type: str
    channel_scope_json: dict | None
    rules_json: dict | None
    valid_from: datetime | None
    valid_to: datetime | None
    status: str
    company_id: UUID
    version: int

class MarketplaceConnectorCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MarketplaceConnectorUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MarketplaceConnectorResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    connector_binding_number: str
    sales_channel_id: UUID
    marketplace_code: str
    int_external_system_id: UUID | None
    int_connector_id: UUID | None
    vendor_id: UUID | None
    sync_mode: str
    last_sync_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class NotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class NotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class NotificationResponse(OrmModel):
    id: UUID
    document_id: UUID | None
    notification_type: str
    recipient_user_id: UUID | None
    recipient_employee_id: UUID | None
    payload_json: dict | None
    sent_at: datetime | None
    delivery_status: str
    status: str
    company_id: UUID
    version: int

class ReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReportResponse(OrmModel):
    id: UUID
    report_code: str
    report_type: str
    period_start: date | None
    period_end: date | None
    department_id: UUID | None
    folder_id: UUID | None
    metrics_json: dict | None
    generated_at: datetime | None
    status: str
    company_id: UUID
    version: int
