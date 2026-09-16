# ERP Core v1.3-beta - Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.3-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal - Confidential |
| **Predecessor** | [ERP Core v1.2-beta](./ERP_Core_v1.2-beta.md) |
| **Ready For** | Sprint 9 - Quality Management (FRD-14) |

---

## 1. Executive Summary

ERP Core **v1.3-beta** advances the multi-tenant Enterprise ERP Platform from the **v1.2-beta** baseline by delivering **Sprint 8 - Manufacturing & Production**.

The platform remains a **Modular Monolith** with **Clean Architecture** and **DDD**, governed by **Architecture Lock v1.1**. Documentation hierarchy BRD → FRD → SDD v1.1 → DBS v1.1 → ERD → code continues to be followed.

**Modules completed through this release:**

- Foundation
- Organization
- Master Data
- Finance
- Sales
- Procurement
- Inventory
- **Manufacturing** (**new**)

**What is new in v1.3-beta:**

- Full Manufacturing & Production domain (`manufacturing` schema, **17** business tables)
- BOM, routing, work centers, machines, production orders, shop-floor operations
- Material issue / return, production receipt, WIP, scrap, and production variance
- Nine manufacturing engines (BOM · Routing · Production · Material Issue · Material Return · Production Receipt · WIP · Scrap · Variance)
- Inventory integration only via Inventory Service (`source_module = manufacturing`) - no direct `inv_*` writes
- Finance system journals via `ManufacturingPostingService` → `PostingService.post_system_journal` - no direct finance table writes
- Migrations `0095`-`0114`; Alembic head `0114_seed_mfg_workflows`
- Test suite at **127 passed**
- FastAPI **374** routes · OpenAPI **255** paths · Manufacturing **37** API paths

**What remains from v1.2-beta:** Foundation through Inventory capabilities are retained without architecture redesign. Warehouse, product, UOM, and employee masters remain authoritative under Master Data (C-01).

This release is **not** production GA. It is the approved gate to start **Sprint 9 - Quality Management (FRD-14)**.

---

## 2. Sprint 8 Highlights

Sprint 8 delivered the **Manufacturing & Production** domain as the converter of raw materials into finished goods, without owning stock mutation.

| Capability | Delivery |
|------------|----------|
| **Manufacturing Module** | `apps/api/src/modules/manufacturing/` - Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **BOM Engine** | Revision-controlled BOM; one active BOM per product; component explosion with scrap % |
| **Routing Engine** | Routing + operations with work center, setup/run time; activate lifecycle |
| **Work Center / Machine** | Resource masters; machine shop-floor status (idle / running / maintenance / breakdown) |
| **Production Engine** | Work order lifecycle: draft → released → in_progress → completed → closed / cancelled |
| **Material Issue Engine** | Issue components to production; confirm → Inventory issue + WIP material ↑ |
| **Material Return Engine** | Return unused components; confirm → Inventory receipt + WIP material ↓ |
| **Production Receipt Engine** | FG receipt into inventory; WIP proportional relief; completed qty update |
| **WIP Engine** | Open WIP balance per order; material / labor / overhead roll-up |
| **Scrap Engine** | Scrap submit / approve / post with cost and order scrapped qty |
| **Variance Engine** | Standard vs actual capture on order close |

**Supporting delivered items:** document numbering (BOM/RTG/WO/MI/MR/FGR/SCR), Celery jobs (machine breakdown, capacity overload, WIP reconcile, finance retry, scrap threshold), RBAC roles, and manufacturing approval workflows.

---

## 3. Manufacturing Module

| Item | Value |
|------|--------|
| **Schema** | `manufacturing` |
| **Prefix** | `mfg_` |
| **Business Tables** | **17** |
| **ERD** | ERD_08 Manufacturing (locked) |
| **FRD** | FRD-13 Manufacturing Domain |

**Tables:** `mfg_bom`, `mfg_bom_line`, `mfg_routing`, `mfg_routing_operation`, `mfg_work_center`, `mfg_machine`, `mfg_production_order`, `mfg_production_operation`, `mfg_material_issue`, `mfg_material_issue_line`, `mfg_material_return`, `mfg_material_return_line`, `mfg_production_receipt`, `mfg_production_receipt_line`, `mfg_wip`, `mfg_scrap`, `mfg_variance`.

**API mount:** `/manufacturing` - BOM, routing, work centers, machines, production orders (+ operations), material issues/returns, production receipts, scrap, WIP, variances, reports.

---

## 4. Inventory Integration

Manufacturing **never** writes `inv_*` tables.

| Trigger | Inventory API | WIP Effect |
|---------|---------------|------------|
| Material issue confirm | `issue_goods` (`source_document_type=material_issue`) | material_cost ↑ |
| Material return confirm | `receive_goods` (`source_document_type=material_return` → return_in) | material_cost ↓ |
| Production receipt confirm | `receive_goods` (`source_document_type=production_receipt`) | proportional relief |

Adapter: `ManufacturingInventoryAdapter` → `InventoryApplicationService` with `source_module=manufacturing` and ledger idempotency.

---

## 5. Finance Integration

Manufacturing **never** writes finance tables directly.

| Trigger | Journal Pattern |
|---------|-----------------|
| Material issue (optional valued post) | Dr WIP / Cr Inventory |
| Material return | Dr Inventory / Cr WIP |
| Production receipt | Dr FG Inventory / Cr WIP |
| Scrap post | Dr Scrap Expense / Cr WIP |
| Variance post | Variance vs WIP per signed amount |

Entry point: `ManufacturingPostingService` → **`PostingService.post_system_journal`** only.

---

## 6. Technical Summary

| Metric | Value |
|--------|--------|
| **Alembic Head** | `0114_seed_mfg_workflows` |
| **Migration range (this release delta)** | `0095_create_mfg_schema` → `0114_seed_mfg_workflows` |
| **Approximate business tables** | Approximately **113** (~96 at v1.2-beta + 17 manufacturing) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, **`manufacturing`** (**10**) |
| **FastAPI routes** | **374** |
| **OpenAPI paths** | **255** |
| **Manufacturing API paths** | **37** |

Architecture pillars unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery · Clean Architecture · DDD · Modular Monolith.

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | PASS - head `0114_seed_mfg_workflows` |
| **FastAPI Startup** | PASS |
| **Swagger** | PASS (`/docs` 200) |
| **OpenAPI** | PASS (`/openapi.json` 200) |
| **Ruff** | PASS |
| **MyPy** | PASS (523 source files) |
| **Pytest** | **127 passed** |

Validation confirmed head `0114_seed_mfg_workflows`, successful application startup, `/docs` and OpenAPI generation, and manufacturing routes registered.

---

## 8. Sprint Timeline

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
| **Sprint 8** | Manufacturing | BOM, routing, WO, issue/return/receipt, WIP, scrap, variance | Complete |

**Overall milestones completed: 9** (Infrastructure Phase Sprint 0 + Delivery Sprints 1-8).

---

## 9. Current ERP Capability

| Capability | Status |
|------------|--------|
| **Authentication** | JWT access/refresh, sessions, tenant users |
| **RBAC** | Role/permission grants across all eight domain modules |
| **Workflow Engine** | Foundation `wf_*` with module-specific approval codes |
| **Audit** | Row audit + business `AuditService` logging |
| **Organization** | Company / branch hierarchy and financial attribution units |
| **Master Data** | Parties, products, warehouses, UOM, tax, currency, assets |
| **Finance** | COA, fiscal calendar, journals, GL, AR/AP, system journal posting |
| **Sales** | Order-to-Cash with inventory reservation and issue hooks |
| **Procurement** | Procure-to-Pay with inventory receipt and return issue hooks |
| **Inventory** | Sole stock writer - balances, ledger, bins, batches, serials, FIFO |
| **Manufacturing** | BOM · routing · WO · material issue/return · FG receipt · WIP · scrap · variance |
| **Shop Floor** | Work centers, machines, production operations progress |

---

## 10. Metrics

| Metric | Value |
|--------|--------|
| **Completed Modules** | **8** (Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing) |
| **Schemas** | **10** |
| **Approx Business Tables** | **~113** |
| **Alembic Head** | `0114_seed_mfg_workflows` |
| **Routes** | **374** FastAPI · **255** OpenAPI · **37** Manufacturing |
| **Tests** | **127 passed** |
| **Quality Status** | Alembic · Startup · Swagger · OpenAPI · Ruff · MyPy · Pytest - **ALL PASS** |

---

## 11. Known Deferred Items

Planned future work only (no defects claimed in this section):

| Deferred Capability | Notes |
|---------------------|--------|
| **Quality Management** | FRD-14 - Sprint 9 |
| **MRP / Production Plan tables** | FRD-13 Phase 2 (shortage → PR via service only in Sprint 8) |
| **Rework orders** | FRD-13 Phase 2 |
| **Advanced APS** | Finite capacity optimizer - utilization alerts only in Sprint 8 |
| **HR** | FRD-09 |
| **CRM** | FRD-05 |
| **Projects** | Later domain |
| **BI** | FRD-18 analytics / fact tables |

Also deferred by prior ERDs (unchanged intent): budgeting, bank reconciliation, advanced WMS, LIFO valuation, full barcode print/scan subsystem, frontend Next.js application.

---

## 12. Sprint 9 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.4-beta** |
| **Sprint** | **Sprint 9 - Quality Management** |
| **Primary FRD** | FRD-14 Quality Management Domain |

**Expected integrations:**

| Module | Role in Sprint 9 |
|--------|------------------|
| **Manufacturing** | In-process / final QC refs to production order / receipt UUIDs |
| **Inventory** | Quarantine / quality status on stock movements |
| **Procurement** | Optional GRN quality inspection hooks |
| **Sales** | Optional delivery / return quality references |

---

## 13. Document Control

| Attribute | Value |
|-----------|--------|
| **Version** | 1.3-beta |
| **Status** | Beta |
| **Classification** | Internal |
| **Release Date** | 2026-07-14 |
| **Recommended Git Tag** | `v1.3-beta` |
| **Architecture Lock** | Maintained (v1.1) |

### Version Timeline

| Version | Date | Scope | Alembic Head | Tests |
|---------|------|--------|--------------|-------|
| **v1.0-alpha** | 2026-07-13 | Sprints 0-5 (Foundation → Sales) | `0055_seed_sales_workflows` | 77 passed |
| **v1.1-beta** | 2026-07-13 | Sprints 0-6 (+ Procurement P2P) | `0077_seed_proc_workflows` | 99 passed |
| **v1.2-beta** | 2026-07-13 | Sprints 0-7 (+ Inventory & Warehouse) | `0094_seed_inv_workflows` | 113 passed |
| **v1.3-beta** | 2026-07-14 | Sprints 0-8 (+ Manufacturing & Production) | `0114_seed_mfg_workflows` | 127 passed |

```text
v1.0-alpha ──(+ Sprint 6)──► v1.1-beta ──(+ Sprint 7)──► v1.2-beta ──(+ Sprint 8 Manufacturing)──► v1.3-beta ──► Sprint 9 Quality (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-14 | Initial ERP Core v1.3-beta release notes after Sprint 8 validation |

---

## Release Completion Summary

| Item | Confirmation |
|------|----------------|
| Release document created | `docs/07_RELEASES/ERP_Core_v1.3-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `ERP_Core_v1.1-beta.md` · `ERP_Core_v1.2-beta.md` unchanged |
| Version | **ERP Core v1.3-beta** |
| Status | Beta Development Release |
| Modules | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · **Manufacturing** |
| Alembic head | **`0114_seed_mfg_workflows`** |
| Quality | Alembic · Startup · Swagger · OpenAPI · Ruff · MyPy · Pytest **127** - PASS |
| Next | **Sprint 9 - Quality Management (FRD-14)** → **v1.4-beta** |

**ERP Core v1.3-beta release documentation completed and ready for release approval.**
