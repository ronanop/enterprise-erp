# ERP Core v1.17-beta - Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.17-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal - Confidential |
| **Predecessor** | [ERP Core v1.16-beta](./ERP_Core_v1.16-beta.md) |
| **Ready For** | Sprint 23 - Next domain per ERP roadmap |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.17-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-15 |
| **Previous Release** | ERP Core v1.16-beta |
| **Architecture Lock** | v1.1 - Preserved |
| **Recommended Git Tag** | `v1.17-beta` |

---

## 2. Sprint 22 Highlights

Sprint 22 delivered the **E-Commerce / External Channel** domain (FRD-22 / ERD_22) as the enterprise omnichannel commerce layer - stores → sales channels → product listings / prices / inventory projections → carts → channel orders → payments → shipments / tracking → returns → coupons / promotions → marketplace connectors → notifications → reports - while **existing masters remain authoritative (C-01)**. No duplicate employee / customer / product / vendor / department masters. This module **extends ERP to external channels** and does **not** replace Sales: **Sales remains order-of-record**, **Inventory remains stock authority**, **Finance** posts only via `PostingService.post_system_journal()`, **Integration Hub** owns marketplace / website / carrier transport (REST / events / webhooks), and **Analytics** remains read-only. Peer bindings use **UUID / services only** - **no peer ORM writes**.

| Capability | Delivery |
|------------|----------|
| **E-Commerce Module** | `apps/api/src/modules/ecommerce/` - Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Stores** | Online / B2B / marketplace brand / headless / portal storefronts with submit / approve |
| **Sales Channels** | Website · mobile · marketplace · dealer / distributor portals |
| **Product Listings** | Channel product publish with submit / approve / publish |
| **Listing Prices** | Retail / wholesale / contract / promotional price windows |
| **Listing Inventory** | Channel ATP projection (Inventory = stock truth) |
| **Customer Carts** | Channel carts bound to `master_customer` |
| **Cart Items** | Listing / product line items |
| **Orders** | Channel orders with map-to-Sales (`sales_order_id` UUID) + submit / accept |
| **Order Items** | Channel order lines with optional Sales line UUID |
| **Payments** | Gateway payments with capture / refund path |
| **Payment Transactions** | Authorize / capture / refund / void / chargeback ledger |
| **Shipments** | Carrier shipments linked to channel orders |
| **Shipping Tracking** | Carrier event stream |
| **Return Requests** | Channel returns with submit / approve |
| **Return Items** | Return lines from order items |
| **Coupons** | Store-scoped coupon codes |
| **Promotions** | Campaign / flash / seasonal rules |
| **Marketplace Connectors** | Hub connector bindings with submit / approve / sync |
| **Notifications** | Order / ship / return / sync operational notifications |
| **Reports** | Channel revenue · orders · conversion · returns · sync performance |
| **Engines (20)** | Store · SalesChannel · ProductListing · ListingPrice · ListingInventory · CustomerCart · CartItem · Order · OrderItem · Payment · PaymentTransaction · Shipment · ShippingTracking · ReturnRequest · ReturnItem · Coupon · Promotion · MarketplaceConnector · Notification · Report |

**Services:** `EcommerceApplicationService`, `StoreService`, `SalesChannelService`, `ProductListingService`, `ListingPriceService`, `ListingInventoryService`, `CustomerCartService`, `CartItemService`, `OrderService`, `OrderItemService`, `PaymentService`, `PaymentTransactionService`, `ShipmentService`, `ShippingTrackingService`, `ReturnRequestService`, `ReturnItemService`, `CouponService`, `PromotionService`, `MarketplaceConnectorService`, `NotificationService`, `ReportService`, **`EcommerceIntegrationService`**, **`EcommerceNumberService`**.

**Supporting delivered items:** document numbering (`STO` / `CHN` / `LST` / `CRT` / `ECO` / `PAY` / `SHP` / `RET` / `CPN` / `PRO` / `MPK`), Celery jobs (`listing_publish_scheduler`, `inventory_sync_pull`, `order_import_poller`, `sales_order_mapper`, `shipment_tracking_poller`, `cart_abandonment_notifier`), RBAC roles (`ECOMMERCE_ADMIN`, `ECOMMERCE_MANAGER`, `MARKETPLACE_MANAGER`, `STORE_OPERATOR`), and workflows (`EC_STORE_APPROVAL`, `EC_LISTING_APPROVAL`, `EC_ORDER_REVIEW`, `EC_RETURN_APPROVAL`, `EC_MARKETPLACE_SYNC`).

---

## 3. E-Commerce / External Channel Module

| Item | Value |
|------|--------|
| **Schema** | `ecommerce` |
| **Prefix** | `ec_` |
| **Business Tables** | **20** |
| **ERD** | ERD_22 E-Commerce / External Channel (locked) |
| **FRD** | FRD-22 E-Commerce & External Channel Integration |
| **API mount** | `/api/v1/ecommerce` |

**Tables:** `ec_store`, `ec_sales_channel`, `ec_product_listing`, `ec_listing_price`, `ec_listing_inventory`, `ec_customer_cart`, `ec_cart_item`, `ec_order`, `ec_order_item`, `ec_payment`, `ec_payment_transaction`, `ec_shipment`, `ec_shipping_tracking`, `ec_return_request`, `ec_return_item`, `ec_coupon`, `ec_promotion`, `ec_marketplace_connector`, `ec_notification`, `ec_report`.

**Coverage:** stores · sales channels · product listings · listing prices · listing inventory · customer carts · cart items · orders · order items · payments · payment transactions · shipments · shipping tracking · return requests · return items · coupons · promotions · marketplace connectors · notifications · reports.

**API mount:** `/api/v1/ecommerce` - stores (+ submit / approve), sales-channels, product-listings (+ submit / approve / publish), listing-prices, listing-inventories, customer-carts, cart-items, orders (+ submit / accept), order-items, payments, payment-transactions, shipments, shipping-trackings, return-requests (+ submit / approve), return-items, coupons, promotions, marketplace-connectors (+ submit / approve / sync), notifications, reports.

---

## 4. Cross Module Integrations

E-Commerce **never** duplicates employee, customer, product, vendor, or department masters. **Existing masters remain authoritative (C-01)**. **Sales remains order-of-record**. **Inventory remains stock authority**. Peers communicate via **services · events · REST / webhooks (Integration Hub) · UUID refs** - **never** via direct ORM writes outside `ec_*`. Finance journals use **`PostingService.post_system_journal()`** only - **no `fin_*` ORM writes**. Analytics remains **read-only**.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_employee` · `master_customer` · `master_product` · `master_vendor` (C-01)** - **no duplicate masters** |
| **Organization** | **`org_department` only** - no E-Commerce department master |
| **Sales** | **Order-of-record** - map via service / `sales_order_id` UUID - **no `sales_*` ORM writes** |
| **Inventory** | **Stock authority** - listing inventory is channel projection - **no Inventory ORM writes** |
| **Finance** | **`PostingService.post_system_journal()`** - store `finance_journal_id` - **no `fin_*` writes** |
| **Integration Hub** | Marketplace / website / carrier **REST · events · webhooks** - connector / system UUID refs only |
| **Analytics** | **Read-only** consumer of channel metrics - **no Analytics ORM writes** |
| **CRM** | Optional interaction UUID - **no CRM ORM writes** |
| **Project** | Optional UUID / event only - **no peer ORM writes** |
| **Asset** | Optional UUID / event only - **no peer ORM writes** |
| **Service** | Optional request UUID from fulfillment exceptions - **no peer ORM writes** |
| **Helpdesk** | Optional ticket UUID from return / shipment exceptions - **no peer ORM writes** |
| **Document** | Optional packing slip / label document UUID - **no Document ORM writes** |
| **GRC** | Optional UUID / event only - **no peer ORM writes** |
| **Foundation** | **Workflow** (`EC_STORE_APPROVAL`, `EC_LISTING_APPROVAL`, `EC_ORDER_REVIEW`, `EC_RETURN_APPROVAL`, `EC_MARKETPLACE_SYNC`); **RBAC** (`ecommerce.*` permissions; roles `ECOMMERCE_ADMIN`, `ECOMMERCE_MANAGER`, `MARKETPLACE_MANAGER`, `STORE_OPERATOR` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **1548** |
| **OpenAPI Paths** | **977** |
| **E-Commerce Routes** | **97** |
| **E-Commerce OpenAPI Paths** | **57** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; E-Commerce / External Channel APIs are visible under `/api/v1/ecommerce/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0420_seed_ecommerce_workflows` |
| **Migration range (this release delta)** | `0399_create_ecommerce_schema` → `0420_seed_ecommerce_workflows` |
| **Approximate business tables** | Approximately **388** (~368 at v1.16-beta + 20 E-Commerce) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `payroll`, `recruitment`, `project`, `asset`, `service`, `helpdesk`, `document`, `grc`, `analytics`, `integration`, **`ecommerce`** (**24**) |

```text
0399_create_ecommerce_schema
        ↓
0420_seed_ecommerce_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** - head `0420_seed_ecommerce_workflows` |
| **FastAPI Startup** | **PASS** - Application startup complete (validated on port **8032**; port 8000 unavailable) |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (2027 files)** |
| **Pytest** | **PASS (287)** |

Validation completed successfully. Head `0420_seed_ecommerce_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and E-Commerce routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| Forward FK create order | UUID-only refs for `listing_price.promotion_id`, `customer_cart.coupon_id` / `converted_order_id`, `order.coupon_id` (tables created before coupon / promotion / order targets) |
| `shared/router.py` | Ruff `--fix` import sort (I001) |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** - no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required ecommerce wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | E-Commerce domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/ecommerce` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed - Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · Helpdesk · Document · GRC · Analytics · Integration untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 23 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.18-beta** (planned) |
| **Sprint** | **Sprint 23 - Next domain per ERP roadmap** |
| **Primary domain** | Per ERP product roadmap (post FRD-22) |

**Planned scope (planning only - no implementation in this release):**

- Next enterprise domain per approved ERP roadmap / FRD sequence
- Continuity with Master Data party / product masters (C-01)
- Optional cross-links to E-Commerce · Integration Hub · Sales · Inventory via UUID / services only
- No redesign of E-Commerce · Integration Hub · Finance modules

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.17-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` · `v1.7-beta` · `v1.8-beta` · `v1.9-beta` · `v1.10-beta` · `v1.11-beta` · `v1.12-beta` · `v1.13-beta` · `v1.14-beta` · `v1.15-beta` · `v1.16-beta` unchanged |
| **Version** | **ERP Core v1.17-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · Helpdesk · Document · GRC · Analytics · Integration · **E-Commerce** |
| **Alembic head** | **`0420_seed_ecommerce_workflows`** |
| **Tests** | **287 passed** |
| **Routes** | **1548** FastAPI · **977** OpenAPI · **97** E-Commerce · **57** E-Commerce OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest - **ALL PASS** |
| **Next** | **Sprint 23 - Next domain per ERP roadmap** |
| **Ready for Git Tag** | **`v1.17-beta`** |

---

## 11. Version Timeline

| Version | Date | Scope | Alembic Head | Tests |
|---------|------|--------|--------------|-------|
| **v1.0-alpha** | 2026-07-13 | Sprints 0-5 (Foundation → Sales) | `0055_seed_sales_workflows` | 77 passed |
| **v1.1-beta** | 2026-07-13 | Sprints 0-6 (+ Procurement P2P) | `0077_seed_proc_workflows` | 99 passed |
| **v1.2-beta** | 2026-07-13 | Sprints 0-7 (+ Inventory & Warehouse) | `0094_seed_inv_workflows` | 113 passed |
| **v1.3-beta** | 2026-07-14 | Sprints 0-8 (+ Manufacturing & Production) | `0114_seed_mfg_workflows` | 127 passed |
| **v1.4-beta** | 2026-07-14 | Sprints 0-9 (+ Quality Management) | `0135_seed_qm_workflows` | 146 passed |
| **v1.5-beta** | 2026-07-14 | Sprints 0-10 (+ CRM) | `0156_seed_crm_workflows` | 158 passed |
| **v1.6-beta** | 2026-07-14 | Sprints 0-11 (+ HRMS) | `0178_seed_hr_workflows` | 169 passed |
| **v1.7-beta** | 2026-07-14 | Sprints 0-12 (+ Payroll) | `0200_seed_payroll_workflows` | 179 passed |
| **v1.8-beta** | 2026-07-14 | Sprints 0-13 (+ Recruitment) | `0222_seed_recruitment_workflows` | 189 passed |
| **v1.9-beta** | 2026-07-14 | Sprints 0-14 (+ Project) | `0244_seed_project_workflows` | 199 passed |
| **v1.10-beta** | 2026-07-14 | Sprints 0-15 (+ Asset) | `0266_seed_asset_workflows` | 209 passed |
| **v1.11-beta** | 2026-07-15 | Sprints 0-16 (+ Service) | `0288_seed_service_workflows` | 219 passed |
| **v1.12-beta** | 2026-07-15 | Sprints 0-17 (+ Helpdesk) | `0310_seed_helpdesk_workflows` | 230 passed |
| **v1.13-beta** | 2026-07-15 | Sprints 0-18 (+ Document / DMS) | `0332_seed_document_workflows` | 241 passed |
| **v1.14-beta** | 2026-07-15 | Sprints 0-19 (+ GRC) | `0354_seed_grc_workflows` | 253 passed |
| **v1.15-beta** | 2026-07-15 | Sprints 0-20 (+ Analytics / BI) | `0376_seed_analytics_workflows` | 266 passed |
| **v1.16-beta** | 2026-07-15 | Sprints 0-21 (+ Integration Hub) | `0398_seed_integration_workflows` | 276 passed |
| **v1.17-beta** | 2026-07-15 | Sprints 0-22 (+ E-Commerce / External Channel) | `0420_seed_ecommerce_workflows` | 287 passed |

```text
v1.16-beta ──(+ Sprint 22 E-Commerce / External Channel)──► v1.17-beta ──► Sprint 23 (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-15 | Initial ERP Core v1.17-beta release notes after Sprint 22 validation |

---

**Confirmations**

- `ERP_Core_v1.17-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.17-beta`**
- Ready to begin Sprint 23 planning

**ERP Core v1.17-beta release documentation completed and ready for release approval.**
