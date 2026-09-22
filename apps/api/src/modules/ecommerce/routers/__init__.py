"""E-Commerce API route handlers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.ecommerce.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.ecommerce.schemas import (
    CartItemCreate,
    CartItemResponse,
    CartItemUpdate,
    CouponCreate,
    CouponResponse,
    CouponUpdate,
    CustomerCartCreate,
    CustomerCartResponse,
    CustomerCartUpdate,
    ListingInventoryCreate,
    ListingInventoryResponse,
    ListingInventoryUpdate,
    ListingPriceCreate,
    ListingPriceResponse,
    ListingPriceUpdate,
    MarketplaceConnectorCreate,
    MarketplaceConnectorResponse,
    MarketplaceConnectorUpdate,
    NotificationCreate,
    NotificationResponse,
    NotificationUpdate,
    OrderCreate,
    OrderItemCreate,
    OrderItemResponse,
    OrderItemUpdate,
    OrderResponse,
    OrderUpdate,
    PaymentCreate,
    PaymentResponse,
    PaymentTransactionCreate,
    PaymentTransactionResponse,
    PaymentTransactionUpdate,
    PaymentUpdate,
    ProductListingCreate,
    ProductListingResponse,
    ProductListingUpdate,
    PromotionCreate,
    PromotionResponse,
    PromotionUpdate,
    ReportCreate,
    ReportResponse,
    ReportUpdate,
    ReturnItemCreate,
    ReturnItemResponse,
    ReturnItemUpdate,
    ReturnRequestCreate,
    ReturnRequestResponse,
    ReturnRequestUpdate,
    SalesChannelCreate,
    SalesChannelResponse,
    SalesChannelUpdate,
    ShipmentCreate,
    ShipmentResponse,
    ShipmentUpdate,
    ShippingTrackingCreate,
    ShippingTrackingResponse,
    ShippingTrackingUpdate,
    StoreCreate,
    StoreResponse,
    StoreUpdate,
)
from modules.ecommerce.service import (
    CartItemService,
    CouponService,
    CustomerCartService,
    ListingInventoryService,
    ListingPriceService,
    MarketplaceConnectorService,
    NotificationService,
    OrderItemService,
    OrderService,
    PaymentService,
    PaymentTransactionService,
    ProductListingService,
    PromotionService,
    ReportService,
    ReturnItemService,
    ReturnRequestService,
    SalesChannelService,
    ShipmentService,
    ShippingTrackingService,
    StoreService,
)
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

stores_router = APIRouter(prefix="/stores", tags=["E-Commerce - Store"])

@stores_router.get("", response_model=APIResponse[list[StoreResponse]])
def list_stores(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.store:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = StoreService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@stores_router.get("/{row_id}", response_model=APIResponse[StoreResponse])
def get_stores(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.store:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=StoreService(db).get(ctx, row_id))

@stores_router.post("", response_model=APIResponse[StoreResponse])
def create_stores(
    body: StoreCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.store:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=StoreService(db).create(ctx, **body.model_dump(exclude_none=True)))

@stores_router.patch("/{row_id}", response_model=APIResponse[StoreResponse])
def update_stores(
    row_id: UUID,
    body: StoreUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.store:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=StoreService(db).update(ctx, row_id, **extract_update_fields(body)))

@stores_router.post("/{row_id}/submit", response_model=APIResponse[StoreResponse])
def submit_stores(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.store:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=StoreService(db).submit(ctx, row_id))

@stores_router.post("/{row_id}/approve", response_model=APIResponse[StoreResponse])
def approve_stores(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.store:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=StoreService(db).approve(ctx, row_id))

sales_channels_router = APIRouter(prefix="/sales-channels", tags=["E-Commerce - SalesChannel"])

@sales_channels_router.get("", response_model=APIResponse[list[SalesChannelResponse]])
def list_sales_channels(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.channel:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SalesChannelService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@sales_channels_router.get("/{row_id}", response_model=APIResponse[SalesChannelResponse])
def get_sales_channels(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.channel:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SalesChannelService(db).get(ctx, row_id))

@sales_channels_router.post("", response_model=APIResponse[SalesChannelResponse])
def create_sales_channels(
    body: SalesChannelCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.channel:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=SalesChannelService(db).create(ctx, **body.model_dump(exclude_none=True)))

@sales_channels_router.patch("/{row_id}", response_model=APIResponse[SalesChannelResponse])
def update_sales_channels(
    row_id: UUID,
    body: SalesChannelUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.channel:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=SalesChannelService(db).update(ctx, row_id, **extract_update_fields(body)))

product_listings_router = APIRouter(prefix="/product-listings", tags=["E-Commerce - ProductListing"])

@product_listings_router.get("", response_model=APIResponse[list[ProductListingResponse]])
def list_product_listings(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ProductListingService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@product_listings_router.get("/{row_id}", response_model=APIResponse[ProductListingResponse])
def get_product_listings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ProductListingService(db).get(ctx, row_id))

@product_listings_router.post("", response_model=APIResponse[ProductListingResponse])
def create_product_listings(
    body: ProductListingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ProductListingService(db).create(ctx, **body.model_dump(exclude_none=True)))

@product_listings_router.patch("/{row_id}", response_model=APIResponse[ProductListingResponse])
def update_product_listings(
    row_id: UUID,
    body: ProductListingUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ProductListingService(db).update(ctx, row_id, **extract_update_fields(body)))

@product_listings_router.post("/{row_id}/submit", response_model=APIResponse[ProductListingResponse])
def submit_product_listings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ProductListingService(db).submit(ctx, row_id))

@product_listings_router.post("/{row_id}/approve", response_model=APIResponse[ProductListingResponse])
def approve_product_listings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=ProductListingService(db).approve(ctx, row_id))

@product_listings_router.post("/{row_id}/publish", response_model=APIResponse[ProductListingResponse])
def publish_product_listings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="publish", data=ProductListingService(db).publish(ctx, row_id))

listing_prices_router = APIRouter(prefix="/listing-prices", tags=["E-Commerce - ListingPrice"])

@listing_prices_router.get("", response_model=APIResponse[list[ListingPriceResponse]])
def list_listing_prices(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.price:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ListingPriceService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@listing_prices_router.get("/{row_id}", response_model=APIResponse[ListingPriceResponse])
def get_listing_prices(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.price:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ListingPriceService(db).get(ctx, row_id))

@listing_prices_router.post("", response_model=APIResponse[ListingPriceResponse])
def create_listing_prices(
    body: ListingPriceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.price:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ListingPriceService(db).create(ctx, **body.model_dump(exclude_none=True)))

@listing_prices_router.patch("/{row_id}", response_model=APIResponse[ListingPriceResponse])
def update_listing_prices(
    row_id: UUID,
    body: ListingPriceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.price:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ListingPriceService(db).update(ctx, row_id, **extract_update_fields(body)))

listing_inventories_router = APIRouter(prefix="/listing-inventories", tags=["E-Commerce - ListingInventory"])

@listing_inventories_router.get("", response_model=APIResponse[list[ListingInventoryResponse]])
def list_listing_inventories(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing_inventory:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ListingInventoryService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@listing_inventories_router.get("/{row_id}", response_model=APIResponse[ListingInventoryResponse])
def get_listing_inventories(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing_inventory:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ListingInventoryService(db).get(ctx, row_id))

@listing_inventories_router.post("", response_model=APIResponse[ListingInventoryResponse])
def create_listing_inventories(
    body: ListingInventoryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing_inventory:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ListingInventoryService(db).create(ctx, **body.model_dump(exclude_none=True)))

@listing_inventories_router.patch("/{row_id}", response_model=APIResponse[ListingInventoryResponse])
def update_listing_inventories(
    row_id: UUID,
    body: ListingInventoryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.listing_inventory:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ListingInventoryService(db).update(ctx, row_id, **extract_update_fields(body)))

customer_carts_router = APIRouter(prefix="/customer-carts", tags=["E-Commerce - CustomerCart"])

@customer_carts_router.get("", response_model=APIResponse[list[CustomerCartResponse]])
def list_customer_carts(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.cart:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = CustomerCartService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@customer_carts_router.get("/{row_id}", response_model=APIResponse[CustomerCartResponse])
def get_customer_carts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.cart:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CustomerCartService(db).get(ctx, row_id))

@customer_carts_router.post("", response_model=APIResponse[CustomerCartResponse])
def create_customer_carts(
    body: CustomerCartCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.cart:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CustomerCartService(db).create(ctx, **body.model_dump(exclude_none=True)))

@customer_carts_router.patch("/{row_id}", response_model=APIResponse[CustomerCartResponse])
def update_customer_carts(
    row_id: UUID,
    body: CustomerCartUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.cart:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CustomerCartService(db).update(ctx, row_id, **extract_update_fields(body)))

cart_items_router = APIRouter(prefix="/cart-items", tags=["E-Commerce - CartItem"])

@cart_items_router.get("", response_model=APIResponse[list[CartItemResponse]])
def list_cart_items(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.cart:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = CartItemService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@cart_items_router.get("/{row_id}", response_model=APIResponse[CartItemResponse])
def get_cart_items(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.cart:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CartItemService(db).get(ctx, row_id))

@cart_items_router.post("", response_model=APIResponse[CartItemResponse])
def create_cart_items(
    body: CartItemCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.cart:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CartItemService(db).create(ctx, **body.model_dump(exclude_none=True)))

@cart_items_router.patch("/{row_id}", response_model=APIResponse[CartItemResponse])
def update_cart_items(
    row_id: UUID,
    body: CartItemUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.cart:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CartItemService(db).update(ctx, row_id, **extract_update_fields(body)))

orders_router = APIRouter(prefix="/orders", tags=["E-Commerce - Order"])

@orders_router.get("", response_model=APIResponse[list[OrderResponse]])
def list_orders(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = OrderService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@orders_router.get("/{row_id}", response_model=APIResponse[OrderResponse])
def get_orders(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OrderService(db).get(ctx, row_id))

@orders_router.post("", response_model=APIResponse[OrderResponse])
def create_orders(
    body: OrderCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=OrderService(db).create(ctx, **body.model_dump(exclude_none=True)))

@orders_router.patch("/{row_id}", response_model=APIResponse[OrderResponse])
def update_orders(
    row_id: UUID,
    body: OrderUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=OrderService(db).update(ctx, row_id, **extract_update_fields(body)))

@orders_router.post("/{row_id}/submit", response_model=APIResponse[OrderResponse])
def submit_orders(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=OrderService(db).submit(ctx, row_id))

@orders_router.post("/{row_id}/accept", response_model=APIResponse[OrderResponse])
def accept_orders(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:accept"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="accept", data=OrderService(db).accept(ctx, row_id))

@orders_router.post("/{row_id}/cancel", response_model=APIResponse[OrderResponse])
def cancel_orders(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:cancel"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="cancel", data=OrderService(db).cancel(ctx, row_id))

order_items_router = APIRouter(prefix="/order-items", tags=["E-Commerce - OrderItem"])

@order_items_router.get("", response_model=APIResponse[list[OrderItemResponse]])
def list_order_items(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = OrderItemService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@order_items_router.get("/{row_id}", response_model=APIResponse[OrderItemResponse])
def get_order_items(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OrderItemService(db).get(ctx, row_id))

@order_items_router.post("", response_model=APIResponse[OrderItemResponse])
def create_order_items(
    body: OrderItemCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=OrderItemService(db).create(ctx, **body.model_dump(exclude_none=True)))

@order_items_router.patch("/{row_id}", response_model=APIResponse[OrderItemResponse])
def update_order_items(
    row_id: UUID,
    body: OrderItemUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.order:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=OrderItemService(db).update(ctx, row_id, **extract_update_fields(body)))

payments_router = APIRouter(prefix="/payments", tags=["E-Commerce - Payment"])

@payments_router.get("", response_model=APIResponse[list[PaymentResponse]])
def list_payments(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.payment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PaymentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@payments_router.get("/{row_id}", response_model=APIResponse[PaymentResponse])
def get_payments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.payment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PaymentService(db).get(ctx, row_id))

@payments_router.post("", response_model=APIResponse[PaymentResponse])
def create_payments(
    body: PaymentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.payment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PaymentService(db).create(ctx, **body.model_dump(exclude_none=True)))

@payments_router.patch("/{row_id}", response_model=APIResponse[PaymentResponse])
def update_payments(
    row_id: UUID,
    body: PaymentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.payment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PaymentService(db).update(ctx, row_id, **extract_update_fields(body)))

@payments_router.post("/{row_id}/capture", response_model=APIResponse[PaymentResponse])
def capture_payments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.payment:capture"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="capture", data=PaymentService(db).capture(ctx, row_id))

@payments_router.post("/{row_id}/refund", response_model=APIResponse[PaymentResponse])
def refund_payments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.payment:refund"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="refund", data=PaymentService(db).refund(ctx, row_id))

payment_transactions_router = APIRouter(prefix="/payment-transactions", tags=["E-Commerce - PaymentTransaction"])

@payment_transactions_router.get("", response_model=APIResponse[list[PaymentTransactionResponse]])
def list_payment_transactions(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.payment_txn:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PaymentTransactionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@payment_transactions_router.get("/{row_id}", response_model=APIResponse[PaymentTransactionResponse])
def get_payment_transactions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.payment_txn:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PaymentTransactionService(db).get(ctx, row_id))

@payment_transactions_router.post("", response_model=APIResponse[PaymentTransactionResponse])
def create_payment_transactions(
    body: PaymentTransactionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.payment_txn:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PaymentTransactionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@payment_transactions_router.patch("/{row_id}", response_model=APIResponse[PaymentTransactionResponse])
def update_payment_transactions(
    row_id: UUID,
    body: PaymentTransactionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.payment_txn:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PaymentTransactionService(db).update(ctx, row_id, **extract_update_fields(body)))

shipments_router = APIRouter(prefix="/shipments", tags=["E-Commerce - Shipment"])

@shipments_router.get("", response_model=APIResponse[list[ShipmentResponse]])
def list_shipments(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.shipment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ShipmentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@shipments_router.get("/{row_id}", response_model=APIResponse[ShipmentResponse])
def get_shipments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.shipment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShipmentService(db).get(ctx, row_id))

@shipments_router.post("", response_model=APIResponse[ShipmentResponse])
def create_shipments(
    body: ShipmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.shipment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ShipmentService(db).create(ctx, **body.model_dump(exclude_none=True)))

@shipments_router.patch("/{row_id}", response_model=APIResponse[ShipmentResponse])
def update_shipments(
    row_id: UUID,
    body: ShipmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.shipment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ShipmentService(db).update(ctx, row_id, **extract_update_fields(body)))

shipping_trackings_router = APIRouter(prefix="/shipping-trackings", tags=["E-Commerce - ShippingTracking"])

@shipping_trackings_router.get("", response_model=APIResponse[list[ShippingTrackingResponse]])
def list_shipping_trackings(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.tracking:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ShippingTrackingService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@shipping_trackings_router.get("/{row_id}", response_model=APIResponse[ShippingTrackingResponse])
def get_shipping_trackings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.tracking:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShippingTrackingService(db).get(ctx, row_id))

@shipping_trackings_router.post("", response_model=APIResponse[ShippingTrackingResponse])
def create_shipping_trackings(
    body: ShippingTrackingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.tracking:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ShippingTrackingService(db).create(ctx, **body.model_dump(exclude_none=True)))

@shipping_trackings_router.patch("/{row_id}", response_model=APIResponse[ShippingTrackingResponse])
def update_shipping_trackings(
    row_id: UUID,
    body: ShippingTrackingUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.tracking:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ShippingTrackingService(db).update(ctx, row_id, **extract_update_fields(body)))

return_requests_router = APIRouter(prefix="/return-requests", tags=["E-Commerce - ReturnRequest"])

@return_requests_router.get("", response_model=APIResponse[list[ReturnRequestResponse]])
def list_return_requests(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ReturnRequestService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@return_requests_router.get("/{row_id}", response_model=APIResponse[ReturnRequestResponse])
def get_return_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ReturnRequestService(db).get(ctx, row_id))

@return_requests_router.post("", response_model=APIResponse[ReturnRequestResponse])
def create_return_requests(
    body: ReturnRequestCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ReturnRequestService(db).create(ctx, **body.model_dump(exclude_none=True)))

@return_requests_router.patch("/{row_id}", response_model=APIResponse[ReturnRequestResponse])
def update_return_requests(
    row_id: UUID,
    body: ReturnRequestUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ReturnRequestService(db).update(ctx, row_id, **extract_update_fields(body)))

@return_requests_router.post("/{row_id}/submit", response_model=APIResponse[ReturnRequestResponse])
def submit_return_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ReturnRequestService(db).submit(ctx, row_id))

@return_requests_router.post("/{row_id}/approve", response_model=APIResponse[ReturnRequestResponse])
def approve_return_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=ReturnRequestService(db).approve(ctx, row_id))

@return_requests_router.post("/{row_id}/reject", response_model=APIResponse[ReturnRequestResponse])
def reject_return_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:reject"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="reject", data=ReturnRequestService(db).reject(ctx, row_id))

return_items_router = APIRouter(prefix="/return-items", tags=["E-Commerce - ReturnItem"])

@return_items_router.get("", response_model=APIResponse[list[ReturnItemResponse]])
def list_return_items(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ReturnItemService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@return_items_router.get("/{row_id}", response_model=APIResponse[ReturnItemResponse])
def get_return_items(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ReturnItemService(db).get(ctx, row_id))

@return_items_router.post("", response_model=APIResponse[ReturnItemResponse])
def create_return_items(
    body: ReturnItemCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ReturnItemService(db).create(ctx, **body.model_dump(exclude_none=True)))

@return_items_router.patch("/{row_id}", response_model=APIResponse[ReturnItemResponse])
def update_return_items(
    row_id: UUID,
    body: ReturnItemUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.return:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ReturnItemService(db).update(ctx, row_id, **extract_update_fields(body)))

coupons_router = APIRouter(prefix="/coupons", tags=["E-Commerce - Coupon"])

@coupons_router.get("", response_model=APIResponse[list[CouponResponse]])
def list_coupons(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.coupon:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = CouponService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@coupons_router.get("/{row_id}", response_model=APIResponse[CouponResponse])
def get_coupons(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.coupon:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CouponService(db).get(ctx, row_id))

@coupons_router.post("", response_model=APIResponse[CouponResponse])
def create_coupons(
    body: CouponCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.coupon:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CouponService(db).create(ctx, **body.model_dump(exclude_none=True)))

@coupons_router.patch("/{row_id}", response_model=APIResponse[CouponResponse])
def update_coupons(
    row_id: UUID,
    body: CouponUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.coupon:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CouponService(db).update(ctx, row_id, **extract_update_fields(body)))

promotions_router = APIRouter(prefix="/promotions", tags=["E-Commerce - Promotion"])

@promotions_router.get("", response_model=APIResponse[list[PromotionResponse]])
def list_promotions(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.promotion:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PromotionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@promotions_router.get("/{row_id}", response_model=APIResponse[PromotionResponse])
def get_promotions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.promotion:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PromotionService(db).get(ctx, row_id))

@promotions_router.post("", response_model=APIResponse[PromotionResponse])
def create_promotions(
    body: PromotionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.promotion:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PromotionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@promotions_router.patch("/{row_id}", response_model=APIResponse[PromotionResponse])
def update_promotions(
    row_id: UUID,
    body: PromotionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.promotion:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PromotionService(db).update(ctx, row_id, **extract_update_fields(body)))

marketplace_connectors_router = APIRouter(prefix="/marketplace-connectors", tags=["E-Commerce - MarketplaceConnector"])

@marketplace_connectors_router.get("", response_model=APIResponse[list[MarketplaceConnectorResponse]])
def list_marketplace_connectors(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.marketplace:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = MarketplaceConnectorService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@marketplace_connectors_router.get("/{row_id}", response_model=APIResponse[MarketplaceConnectorResponse])
def get_marketplace_connectors(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.marketplace:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MarketplaceConnectorService(db).get(ctx, row_id))

@marketplace_connectors_router.post("", response_model=APIResponse[MarketplaceConnectorResponse])
def create_marketplace_connectors(
    body: MarketplaceConnectorCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.marketplace:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=MarketplaceConnectorService(db).create(ctx, **body.model_dump(exclude_none=True)))

@marketplace_connectors_router.patch("/{row_id}", response_model=APIResponse[MarketplaceConnectorResponse])
def update_marketplace_connectors(
    row_id: UUID,
    body: MarketplaceConnectorUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.marketplace:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=MarketplaceConnectorService(db).update(ctx, row_id, **extract_update_fields(body)))

@marketplace_connectors_router.post("/{row_id}/submit", response_model=APIResponse[MarketplaceConnectorResponse])
def submit_marketplace_connectors(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.marketplace:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=MarketplaceConnectorService(db).submit(ctx, row_id))

@marketplace_connectors_router.post("/{row_id}/approve", response_model=APIResponse[MarketplaceConnectorResponse])
def approve_marketplace_connectors(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.marketplace:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=MarketplaceConnectorService(db).approve(ctx, row_id))

@marketplace_connectors_router.post("/{row_id}/sync", response_model=APIResponse[MarketplaceConnectorResponse])
def sync_marketplace_connectors(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.marketplace:sync"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="sync", data=MarketplaceConnectorService(db).sync(ctx, row_id))

notifications_router = APIRouter(prefix="/notifications", tags=["E-Commerce - Notification"])

@notifications_router.get("", response_model=APIResponse[list[NotificationResponse]])
def list_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = NotificationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@notifications_router.get("/{row_id}", response_model=APIResponse[NotificationResponse])
def get_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=NotificationService(db).get(ctx, row_id))

@notifications_router.post("", response_model=APIResponse[NotificationResponse])
def create_notifications(
    body: NotificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=NotificationService(db).create(ctx, **body.model_dump(exclude_none=True)))

@notifications_router.patch("/{row_id}", response_model=APIResponse[NotificationResponse])
def update_notifications(
    row_id: UUID,
    body: NotificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=NotificationService(db).update(ctx, row_id, **extract_update_fields(body)))

@notifications_router.post("/{row_id}/acknowledge", response_model=APIResponse[NotificationResponse])
def acknowledge_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.notification:acknowledge"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="acknowledge", data=NotificationService(db).acknowledge(ctx, row_id))

reports_router = APIRouter(prefix="/reports", tags=["E-Commerce - Report"])

@reports_router.get("", response_model=APIResponse[list[ReportResponse]])
def list_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ReportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@reports_router.get("/{row_id}", response_model=APIResponse[ReportResponse])
def get_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ReportService(db).get(ctx, row_id))

@reports_router.post("", response_model=APIResponse[ReportResponse])
def create_reports(
    body: ReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ReportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@reports_router.patch("/{row_id}", response_model=APIResponse[ReportResponse])
def update_reports(
    row_id: UUID,
    body: ReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("ecommerce.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ReportService(db).update(ctx, row_id, **extract_update_fields(body)))

