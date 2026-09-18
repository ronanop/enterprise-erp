# ERP Core v1.2-beta - Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.2-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal - Confidential |
| **Predecessor** | [ERP Core v1.1-beta](./ERP_Core_v1.1-beta.md) |
| **Ready For** | Sprint 8 - Manufacturing / Production |

---

## 1. Executive Summary

ERP Core **v1.2-beta** advances the multi-tenant iConnect Plus from the **v1.1-beta** baseline by delivering **Sprint 7 - Inventory & Warehouse**.

The platform remains a **Modular Monolith** with **Clean Architecture** and **DDD**, governed by **Architecture Lock v1.1**. Documentation hierarchy BRD → FRD → SDD v1.1 → DBS v1.1 → ERD → code continues to be followed.

**Modules completed through this release:**

- Foundation
- Organization
- Master Data
- Finance
- Sales
- Procurement
- **Inventory** (**new**)

**What is new in v1.2-beta:**

- Full Inventory & Warehouse domain (`inventory` schema, 14 business tables)
- Stock balances, append-only stock ledger, bins, batches, serials
- Reservation, receipt, issue, transfer, adjustment, cycle count, and FIFO valuation engines
- Real Inventory Service adapters replacing Procurement/Sales no-op inventory stubs
- Finance system-journal posting for inventory adjustments via `PostingService.post_system_journal`
- Migrations `0078`-`0094`; Alembic head `0094_seed_inv_workflows`
- Test suite expanded to **113 passed**
- FastAPI **326** routes · OpenAPI **218** paths · Inventory **31** API paths

**What remains from v1.1-beta:** Foundation through Procurement capabilities are retained without architecture redesign. Warehouse identity continues to use authoritative `master_warehouse` (C-01).

This release is **not** production GA. It is the approved gate to start **Sprint 8 - Manufacturing / Production**.

---

## 2. Sprint 7 Highlights

Sprint 7 delivered the **Inventory & Warehouse** domain as the sole writer of stock quantities (`inv_*`).

| Capability | Delivery |
|------------|----------|
| **Inventory Module** | `apps/api/src/modules/inventory/` - Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Warehouse Management** | Bin hierarchy under `master_warehouse`; bin types (storage, quarantine, staging, in_transit) |
| **Stock Engine** | On-hand / reserved / available ATP math; hard block on negative available |
| **Reservation Engine** | Reserve / partial issue / fulfill / release for sales and extensible sources |
| **Receipt Engine** | Goods receipt movements (GRN, sales return, transfer-in, count gain) |
| **Issue Engine** | Goods issue movements (delivery, purchase return, transfer-out, count loss) |
| **Transfer Engine** | Warehouse/bin transfer lifecycle: draft → submit → approve → ship → receive → close |
| **Adjustment Engine** | Signed quantity corrections with approval and post |
| **FIFO Valuation** | `inv_valuation_layer` create on receipt; consume oldest open layers on issue |
| **Cycle Count** | System vs counted variance; post variances to stock |
| **Inventory Ledger** | Append-only `inv_stock_ledger` with source document traceability |

**Supporting delivered items:** reorder policies, document numbering (ILE/TRF/ADJ/CNT/BATCH/SN), Celery jobs (low stock, batch expiry, reservation cleanup, reconciliation, finance retry), RBAC roles, and inventory approval workflows.

---

## 3. Cross Module Integration

Inventory is the **only** module allowed to mutate `inv_*` tables. Sales and Procurement call Inventory application services / adapters.

| Module | Integration |
|--------|-------------|
| **Procurement** | GRN confirm → **Inventory Receipt**; purchase return receive → **Inventory Issue** (via warehouse from linked GRN) |
| **Sales** | Order confirm → **Sales Reservation**; order cancel → release; delivery ship → **Delivery Shipment / Issue**; sales return receive → **Sales Return Receipt** |
| **Finance** | `InventoryPostingService` → **`PostingService.post_system_journal`** for valued adjustments; respects period / inventory-closed guards |
| **Foundation** | **Workflow** (`INV_TRANSFER_APPROVAL`, `INV_ADJUSTMENT_APPROVAL`, `INV_CYCLE_COUNT_APPROVAL`); **Audit** on stock/document events; **RBAC** (`inventory.*` permissions, warehouse roles) |
| **Master Data** | Product, UOM, and **`master_warehouse`** FKs only - no duplicate warehouse master |

Sprint 6 `NoOpInventoryAdapter` is replaced by real `ProcurementInventoryAdapter` / `SalesInventoryAdapter` implementations.

---

## 4. Technical Summary

| Metric | Value |
|--------|--------|
| **Alembic Head** | `0094_seed_inv_workflows` |
| **Migration range (this release delta)** | `0078_create_inventory_schema` → `0094_seed_inv_workflows` |
| **Approximate business tables** | Approximately **96** (~82 at v1.1-beta + 14 inventory) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, **`inventory`** (**9**) |
| **FastAPI routes** | **326** |
| **OpenAPI paths** | **218** |
| **Inventory API paths** | **31** |

Architecture pillars unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery · Clean Architecture · DDD · Modular Monolith.

---

## 5. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | PASS |
| **FastAPI Startup** | PASS |
| **Swagger** | PASS |
| **OpenAPI** | PASS |
| **Ruff** | PASS |
| **MyPy** | PASS |
| **Pytest** | **113 passed** |

Validation confirmed head `0094_seed_inv_workflows`, successful application startup, `/docs` and OpenAPI generation, and inventory routes registered.

---

## 6. Sprint Timeline

| Sprint | Phase | Scope | Outcome |
|--------|-------|--------|---------|
| **Sprint 0** | Infrastructure | Bootstrap, Docker, Alembic, app scaffold | Complete |
| **Sprint 1** | Foundation | Auth, RBAC, workflow, notification, audit, settings | Complete |
| **Sprint 2** | Organization | Company, branch, department, BU, location, CC/PC | Complete |
| **Sprint 3** | Master Data | Vendor, customer, product, employee, warehouse, UOM, tax, currency, asset | Complete |
| **Sprint 4** | Finance | COA, fiscal, journals, GL, AR/AP, tax register, FX, asset txns | Complete |
| **Sprint 5** | Sales | Pricing, credit, quotation → order → delivery → invoice → return | Complete |
| **Sprint 6** | Procurement | PR → RFQ → quote → comparison → PO → GRN → invoice → return | Complete |
| **Sprint 7** | Inventory | Stock, warehouse bins, reservation, transfer, adjustment, FIFO, cycle count | Complete |

**Overall milestones completed: 8** (Infrastructure Phase Sprint 0 + Delivery Sprints 1-7).

---

## 7. Current ERP Capability

| Capability | Status |
|------------|--------|
| **Authentication** | JWT access/refresh, sessions, tenant users |
| **RBAC** | Role/permission grants across all seven domain modules |
| **Workflow Engine** | Foundation `wf_*` with module-specific approval codes |
| **Audit** | Row audit + business `AuditService` logging |
| **Organization** | Company / branch hierarchy and financial attribution units |
| **Master Data** | Parties, products, warehouses, UOM, tax, currency, assets |
| **Finance** | COA, fiscal calendar, journals, GL, AR/AP, system journal posting |
| **Sales** | Order-to-Cash with inventory reservation and issue hooks |
| **Procurement** | Procure-to-Pay with inventory receipt and return issue hooks |
| **Inventory** | Balances, ledger, bins, batches, serials, policies |
| **Warehouse** | Bin locations under `master_warehouse` |
| **Stock Ledger** | Append-only movement history with source traceability |
| **Reservations** | ATP reservation / release / issue-against-reservation |
| **FIFO Valuation** | Cost layers created on receipt and consumed on issue |

---

## 8. Metrics

| Metric | Value |
|--------|--------|
| **Completed Modules** | **7** (Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory) |
| **Schemas** | **9** |
| **Approx Business Tables** | **~96** |
| **Alembic Head** | `0094_seed_inv_workflows` |
| **Routes** | **326** FastAPI · **218** OpenAPI · **31** Inventory |
| **Tests** | **113 passed** |
| **Quality Status** | Alembic · Startup · Swagger · OpenAPI · Ruff · MyPy · Pytest - **ALL PASS** |

---

## 9. Known Deferred Items

Planned future work only (no defects claimed in this section):

| Deferred Capability | Notes |
|---------------------|--------|
| **Manufacturing** | FRD-13 - Sprint 8 |
| **Quality** | FRD-14 |
| **HR** | FRD-09 |
| **CRM** | FRD-05 |
| **Projects** | Later domain |
| **Assets Advanced** | Beyond core asset master / transactions already present |
| **BI** | FRD-18 analytics / fact tables |

Also deferred by prior ERDs (unchanged intent): budgeting, bank reconciliation, advanced WMS, LIFO valuation, full barcode print/scan subsystem, frontend Next.js application.

---

## 10. Sprint 8 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.3-beta** |
| **Sprint** | **Sprint 8 - Manufacturing / Production** |
| **Primary FRD** | FRD-13 Manufacturing Domain |

**Expected integrations:**

| Module | Role in Sprint 8 |
|--------|------------------|
| **Inventory** | Component issue / FG receipt via Inventory Service (`source_module = manufacturing`) |
| **Finance** | Production cost / WIP / COGS system journals as defined by Manufacturing ERD |
| **Procurement** | Material supply context; PO/GRN already feed stock used by production |

---

## 11. Document Control

| Attribute | Value |
|-----------|--------|
| **Version** | 1.2-beta |
| **Status** | Beta |
| **Classification** | Internal |
| **Release Date** | 2026-07-13 |
| **Recommended Git Tag** | `v1.2-beta` |
| **Architecture Lock** | Maintained (v1.1) |

### Version Timeline

| Version | Date | Scope | Alembic Head | Tests |
|---------|------|--------|--------------|-------|
| **v1.0-alpha** | 2026-07-13 | Sprints 0-5 (Foundation → Sales) | `0055_seed_sales_workflows` | 77 passed |
| **v1.1-beta** | 2026-07-13 | Sprints 0-6 (+ Procurement P2P) | `0077_seed_proc_workflows` | 99 passed |
| **v1.2-beta** | 2026-07-13 | Sprints 0-7 (+ Inventory & Warehouse) | `0094_seed_inv_workflows` | 113 passed |

```text
v1.0-alpha ──(+ Sprint 6 Procurement)──► v1.1-beta ──(+ Sprint 7 Inventory)──► v1.2-beta ──► Sprint 8 Manufacturing (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-13 | Initial ERP Core v1.2-beta release notes after Sprint 7 validation |

---

## Release Completion Summary

| Item | Confirmation |
|------|----------------|
| Release document created | `docs/07_RELEASES/ERP_Core_v1.2-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `ERP_Core_v1.1-beta.md` unchanged |
| Version | **ERP Core v1.2-beta** |
| Status | Beta Development Release |
| Modules | Foundation · Organization · Master Data · Finance · Sales · Procurement · **Inventory** |
| Alembic head | **`0094_seed_inv_workflows`** |
| Quality | Alembic · Startup · Swagger · OpenAPI · Ruff · MyPy · Pytest **113** - PASS |
| Next | **Sprint 8 - Manufacturing / Production** → **v1.3-beta** |

**ERP Core v1.2-beta release documentation completed and ready for release approval.**
