# ERP Core v1.1-beta - Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.1-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Chief Software Architect · Enterprise Solution Architect · Technical Program Manager · ERP Release Manager |
| **Classification** | Internal - Confidential |
| **Predecessor** | [ERP Core v1.0-alpha](./ERP_Core_v1.0-alpha.md) |
| **Ready For** | Sprint 7 - Inventory & Warehouse |

---

## 1. Release Information

| Attribute | Value |
|-----------|--------|
| **Version** | ERP Core v1.1-beta |
| **Release Date** | 2026-07-13 |
| **Status** | Beta Development Release - Procure-to-Pay complete |
| **Recommended Git Tag** | `v1.1-beta` |
| **Alembic Head** | `0077_seed_proc_workflows` |
| **Architecture Lock** | Maintained (v1.1) |
| **Baseline Delta** | Adds Sprint 6 Procurement on top of v1.0-alpha (Sprints 0-5) |

---

## 2. Executive Summary

ERP Core **v1.1-beta** advances the multi-tenant iConnect Plus from the **v1.0-alpha** development baseline by delivering **Sprint 6 - Procurement (Procure-to-Pay)**.

The platform remains a **Modular Monolith** with **Clean Architecture** and **DDD**, governed by **Architecture Lock v1.1**. Documentation hierarchy BRD → FRD → SDD v1.1 → DBS v1.1 → ERD → code continues to be followed.

**What is new in v1.1-beta:**

- Full Procurement domain (`procurement` schema, 19 business tables)
- P2P spine: PR → RFQ → Vendor Quotation → Comparison → PO → GRN → Invoice → Return
- Finance AP posting via system journals (`PostingService.post_system_journal`)
- Inventory integration as **port/stub only** (no inventory stock tables; Sprint 7)
- Migrations `0056`-`0077`; Alembic head `0077_seed_proc_workflows`
- Test suite expanded to **99 passed**

**What remains from v1.0-alpha:** Foundation, Organization, Master Data, Finance, and Sales Order-to-Cash capabilities are retained without architecture redesign.

This release is **not** production GA. It is the approved gate to start **Sprint 7 - Inventory & Warehouse**.

---

## 3. Completed Sprints

| Sprint | Phase | Scope | Outcome |
|--------|-------|--------|---------|
| **Sprint 0** | Infrastructure | Bootstrap, Docker, Alembic, app scaffold | Complete |
| **Sprint 1** | Foundation | Auth, RBAC, workflow, notification, audit, settings | Complete |
| **Sprint 2** | Organization | Company, branch, department, BU, location, CC/PC | Complete |
| **Sprint 3** | Master Data | Vendor, customer, product, employee, warehouse, UOM, tax, currency, asset | Complete |
| **Sprint 4** | Finance | COA, fiscal, journals, GL, AR/AP, tax register, FX, asset txns | Complete |
| **Sprint 5** | Sales | Pricing, credit, quotation → order → delivery → invoice → return | Complete |
| **Sprint 6** | Procurement | PR → RFQ → quote → comparison → PO → GRN → invoice → return | Complete |

**Overall milestones completed: 7** (Infrastructure Phase Sprint 0 + Delivery Sprints 1-6).

---

## 4. Modules Delivered

| Module | Schema | ERD | FRD | Status |
|--------|--------|-----|-----|--------|
| Foundation | `foundation`, `audit`, `config` | ERD_01 | FRD-01 | Stable |
| Organization | `organization` | ERD_02 | FRD-02 | Stable |
| Master Data | `master` | ERD_03 | FRD-03 | Stable |
| Finance | `finance` | ERD_04 | FRD-04 | Stable (budget/bank deferred) |
| Sales | `sales` | ERD_05 | FRD-06 | Stable (CRM/inventory stock deferred) |
| Procurement | `procurement` | ERD_06 | FRD-07 | Stable (inventory stock deferred) |

**Domain modules implemented: 6**  
**Documented ERDs: 6** (`ERD_01` … `ERD_06`)

---

## 5. Business Processes Implemented

### 5.1 Authentication & RBAC
- JWT access/refresh, sessions, tenant users and roles
- Permission grants per module; SoD on approve/post paths
- Org-scoped user access (`sec_user_org_scope`)

### 5.2 Organization Management
- Company and branch hierarchy; departments, BUs, locations
- Cost centers and profit centers for financial attribution

### 5.3 Master Data Management
- Customers, vendors, products, categories, employees
- UOM, currency, tax, warehouses, assets
- C-01: no duplicate masters in transactional schemas

### 5.4 Finance
- Chart of accounts, fiscal years/periods, journals, GL posting
- AR (`fin_customer_ledger`) and AP (`fin_vendor_ledger`)
- Tax register, FX rates, cost allocations, asset transactions
- System journal posting for Sales and Procurement integrations

### 5.5 Order-to-Cash (Sales)
- Price lists, discounts, customer credit
- Quotation → Order → Delivery → Invoice → Return
- AR posting and credit exposure updates on invoice/return

### 5.6 Procure-to-Pay (Procurement) - **new in v1.1-beta**
- Purchase requisition (priority, department, cost center)
- RFQ with invited vendors; vendor quotations and comparison engine
- Vendor contracts; purchase orders with receive/invoice qty tracking
- GRN with warehouse reference (inventory via stub port only)
- Purchase invoice and return with AP posting
- Vendor performance analytical snapshots (Celery-oriented)

---

## 6. Technical Architecture

| Pillar | Status | Notes |
|--------|--------|--------|
| **Clean Architecture** | Locked | Router → Service → Repository → Database |
| **DDD** | Locked | Domain enums/entities/VOs independent of ORM |
| **Modular Monolith** | Locked (ADR-001) | Schema + package boundaries |
| **FastAPI** | Locked | OpenAPI/Swagger enabled |
| **SQLAlchemy 2.0** | Locked | Infrastructure models only |
| **Alembic** | Locked | Sole schema change path |
| **PostgreSQL** | Locked | Primary transactional store |
| **Redis** | Locked | Cache, session, Celery backend |
| **RabbitMQ** | Locked | Celery broker |
| **Celery** | Locked | Background tasks (stubs + operational jobs planned) |
| **Docker** | Locked | Local/environment orchestration |
| Frontend (Next.js stack) | Locked, not delivered in this backend beta | Deferred UI |

---

## 7. Database Summary

### 7.1 Schemas Implemented (8)

| Schema | Module / Concern |
|--------|------------------|
| `foundation` | Security, workflow, notifications |
| `audit` | Audit log / events |
| `config` | Tenant settings |
| `organization` | Org hierarchy |
| `master` | Master data |
| `finance` | Accounting |
| `sales` | Order-to-Cash |
| `procurement` | Procure-to-Pay (**new**) |

### 7.2 Metrics

| Metric | Value |
|--------|--------|
| **Approximate business table count** | Approximately **82** business tables (~63 at v1.0-alpha + 19 procurement) |
| **Migration files** | **77** (`0001` … `0077`) |
| **Migration range (this release delta)** | `0056_create_procurement_schema` → `0077_seed_proc_workflows` |
| **Current Alembic Head** | **`0077_seed_proc_workflows`** |
| **Governance** | UUID PKs, soft delete, audit columns, tenant/company/branch isolation |

---

## 8. API Summary

### 8.1 API Groups (under v1)

| Group | Area |
|-------|------|
| Health | Health checks |
| Foundation | Auth, tenants, users, RBAC, workflows, notifications, audit, settings |
| Organization | Companies, hierarchy, org tree, auth context |
| Master Data | UOM, currency, tax, categories, employees, customers, vendors, products, warehouses, assets |
| Finance | COA, fiscal, journals, GL, AR, AP, tax register, FX, asset txns, reports |
| Sales | Pricing, credit, quotations, orders, deliveries, invoices, returns |
| Procurement | Requisitions, RFQs, vendor quotations, comparisons, contracts, orders, GRNs, invoices, returns, performance |

**Total major API groups: 7** (Health + 6 domain modules).

### 8.2 OpenAPI

| Item | Status |
|------|--------|
| FastAPI OpenAPI | Enabled |
| Swagger UI | `/docs` |
| ReDoc | `/redoc` |
| Contract style | Pydantic v2 + `APIResponse` envelope |

---

## 9. Quality Gates

| Gate | Status | Notes |
|------|--------|--------|
| **Ruff** | PASS | Production and module sources clean |
| **MyPy** | PASS (production) | `modules.procurement.*` included; residual issues limited to test stub typing where present |
| **Pytest** | PASS | **99 passed** (full suite at v1.1-beta gate) |
| **Alembic** | PASS | Head `0077_seed_proc_workflows` applied |
| **FastAPI Startup** | PASS | Application factory loads; routers mounted |

---

## 10. Security Features

| Control | Status |
|---------|--------|
| JWT authentication | Implemented |
| RBAC (role/permission grants) | Implemented across all six domain modules |
| Tenant isolation | `tenant_id` on multi-tenant entities |
| Company / branch isolation | Scope validators + org scope |
| Audit trail | `audit_log` / `audit_event` + service logging |
| Workflow approvals | Foundation `wf_*` with module-specific codes |
| Segregation of duties | Creator cannot approve own governed documents; system journals skip SoD for posting |

---

## 11. Deferred Features

| Deferred Capability | Notes |
|---------------------|--------|
| **Inventory stock movement tables** (`inv_*`) | Sprint 7; GRN uses Inventory Port stub only |
| **Budgeting** (`fin_budget_*`) | ERD_04 Phase 2 |
| **Bank reconciliation** (`fin_bank_*`) | ERD_04 out of Sprint 4 |
| **CRM** (`crm_*`) | FRD-05 / later sprint |
| **Manufacturing** | FRD-13 |
| **Payroll** | FRD-10 (after HR) |
| **HR** | FRD-09 - Sprint 8 planned |
| Full Celery job bodies | Many tasks remain stubs |
| Frontend Next.js application | Locked stack; not in this backend beta |

---

## 12. Known Limitations

1. **Inventory:** GRN/return emit inventory port calls via no-op adapter - stock ledgers not updated until Sprint 7.
2. **3-way match:** Implemented at service layer (`match_status`); no dedicated match tables.
3. **Vendor performance:** Analytical snapshot table; populated by scheduled jobs (stub/recalc path).
4. **Attachments:** DMS blobs out of scope; optional reference UUIDs only.
5. **Quality Management:** GRN quality fields are placeholders for FRD-14.
6. **Mypy on full `src`:** Some sales/procurement **test** stub helpers may still raise `no-untyped-call` / `arg-type` when checking tests strictly; production modules pass under Architecture Lock overrides.
7. **Not production GA:** No formal UAT sign-off or hardening sprint claimed in this release.

---

## 13. Next Planned Sprint

| Sprint | Module | Primary FRD | Focus |
|--------|--------|-------------|--------|
| **Sprint 7** | **Inventory & Warehouse** | FRD-08 | Stock ledgers, movements, reservation/issue; replace Procurement/Sales inventory stubs with real Inventory Service |

Subsequent roadmap (unchanged intent from v1.0-alpha): Sprint 8 HR → Sprint 9 Payroll → Sprint 10 CRM.

---

## 14. Version Timeline

| Version | Date | Scope | Alembic Head | Tests |
|---------|------|--------|--------------|-------|
| **v1.0-alpha** | 2026-07-13 | Sprints 0-5 (Foundation → Sales) | `0055_seed_sales_workflows` | 77 passed |
| **v1.1-beta** | 2026-07-13 | Sprints 0-6 (+ Procurement P2P) | `0077_seed_proc_workflows` | 99 passed |

```text
v1.0-alpha ──(+ Sprint 6 Procurement)──► v1.1-beta ──► Sprint 7 Inventory (planned)
```

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-13 | Initial ERP Core v1.1-beta release notes after Sprint 6 |

---

## Release Completion Summary

| Item | Confirmation |
|------|----------------|
| Release document created | `docs/07_RELEASES/ERP_Core_v1.1-beta.md` |
| Prior release unmodified | `ERP_Core_v1.0-alpha.md` unchanged |
| Version | **ERP Core v1.1-beta** |
| Status | Beta Development Release |
| Modules | Foundation · Organization · Master Data · Finance · Sales · **Procurement** |
| Alembic head | **`0077_seed_proc_workflows`** |
| Quality | Ruff PASS · MyPy production PASS · Pytest **99** · Startup PASS |
| Next | **Sprint 7 - Inventory & Warehouse** |

**ERP Core v1.1-beta release documentation completed and ready for release approval.**
