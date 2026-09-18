# ERP Core v1.0-alpha - Enterprise Baseline Report

| Field | Value |
|-------|--------|
| **Document Type** | Release Baseline / Development Gate |
| **Release Name** | ERP Core v1.0-alpha |
| **Release Status** | Stable Development Baseline |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Chief Software Architect · Enterprise Solution Architect · Technical Program Manager · ERP Release Manager |
| **Classification** | Internal - Confidential |
| **Baseline Date** | 2026-07-13 |
| **Alembic Head** | `0055_seed_sales_workflows` |
| **Ready For** | Sprint 6 Development |

---

## 1. Executive Summary

ERP Core **v1.0-alpha** establishes the first **stable development baseline** of the multi-tenant iConnect Plus after completion of the **Infrastructure Phase (Sprint 0)** and **Delivery Sprints 1-5 (Foundation through Sales)**.

**Overall milestones completed: 6** (Sprint 0 + Sprints 1-5).

The platform implements a **Modular Monolith** with **Clean Architecture** and **DDD**, under **Architecture Lock v1.1** (ADR-001 Modular Monolith; ADR-002 Python/FastAPI stack). Documentation hierarchy BRD → FRD → SDD v1.1 → DBS v1.1 → ERD → code has been followed for all delivered modules.

**Delivered capability (alpha core):**

- Multi-tenant identity, RBAC, workflow, notification, and audit (Foundation)
- Organizational structure and scope isolation (Organization)
- Shared masters for parties, products, employees, warehouses, and assets (Master Data)
- Core financials: COA, fiscal calendar, journals, GL, AR/AP, tax register, FX rates, asset transactions (Finance)
- Order-to-Cash spine: pricing, credit, quotation → order → delivery → invoice → return with Finance posting (Sales)

**Quality posture:** Alembic at head `0055_seed_sales_workflows`; full pytest suite green (**77 passed**); Ruff clean on `src`; production modules type-check under Mypy. Remaining Mypy findings are confined to **test stub typing** and do not affect production modules.

This baseline is **not** a production GA release. It is the approved gate to start **Sprint 6 - Procurement** without architecture redesign.

---

## 2. Architecture Baseline

### 2.1 Patterns (Locked)

| Pattern | Status | Notes |
|---------|--------|--------|
| **Clean Architecture** | Locked | Router → Service → Repository → Database (DG-02) |
| **Domain-Driven Design (DDD)** | Locked | Domain enums/entities/VOs independent of ORM |
| **Modular Monolith** | Locked (ADR-001) | Module boundaries by PostgreSQL schema + package |

### 2.2 Technology Stack (Locked - Architecture Lock v1.1)

| Layer | Technology | Role in Baseline |
|-------|------------|------------------|
| API | **FastAPI** | HTTP API, OpenAPI/Swagger |
| ORM | **SQLAlchemy 2.0** | Infrastructure models only (PY-03) |
| Validation | **Pydantic v2** | Request/response schemas |
| Migrations | **Alembic** | Sole schema change path (PY-04) |
| Database | **PostgreSQL** | Primary transactional store |
| Cache / sessions | **Redis** | Cache, session, Celery result backend |
| Messaging | **RabbitMQ** | Celery broker |
| Async jobs | **Celery** (+ Beat planned) | Background / scheduled tasks |
| Runtime | **Python 3.13+**, Uvicorn/Gunicorn | ASGI serving |
| Packaging | **Docker** / Compose | Local and environment orchestration |
| Frontend (locked, not in this alpha backend baseline) | Next.js 16+, TypeScript, Tailwind, ShadCN | Deferred UI delivery |

### 2.3 Governance Sources of Truth

1. `docs/01_BRD`
2. `docs/02_FRD` (22 domains + Master FRD)
3. `docs/03_SDD` (SDD v1.1)
4. `docs/04_DBS` (DBS v1.1)
5. `docs/05_ARCHITECTURE_LOCK` (Architecture Lock Report v1.1)
6. `docs/06_ERD` (ERD_01 … ERD_05)
7. `.cursor/rules/erp-architecture.mdc`

### 2.4 Non-Negotiables Preserved

- UUID PKs, soft delete, audit columns, tenant/company/branch isolation on transactional data
- No NestJS / Prisma / MongoDB primary
- No business logic in routers; no cross-module DB writes bypassing services
- Workflow, Notification, and Audit engines not bypassed for governed operations

---

## 3. Completed Modules

### 3.1 Foundation (Sprint 1)

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Multi-tenant security platform: auth, RBAC, org scope, workflow, notifications, audit, settings |
| **Status** | **Complete** - Stable |
| **Schema(s)** | `foundation`, `audit`, `config` |
| **Database tables** | `sec_tenant`, `sec_user`, `sec_role`, `sec_permission`, `sec_user_role`, `sec_role_permission`, `sec_session`, `sec_refresh_token`, `sec_user_org_scope`; `wf_definition`, `wf_step`, `wf_instance`, `wf_action`; `ntf_template`, `ntf_event`, `ntf_delivery`; `cfg_setting`; `audit_log`, `audit_event` |
| **APIs** | `/auth`, `/tenants`, `/users`, `/roles`, `/permissions`, `/workflows`, `/notifications`, `/audit`, `/settings` |
| **Integrations** | Consumed by all later modules for JWT context, permissions, workflow instances, audit logging |

### 3.2 Organization (Sprint 2)

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Legal and operational hierarchy: company, branch, department, BU, location, cost/profit centers |
| **Status** | **Complete** - Stable |
| **Schema** | `organization` |
| **Database tables** | `org_company`, `org_branch`, `org_department`, `org_business_unit`, `org_location`, `org_cost_center`, `org_profit_center` |
| **APIs** | `/companies`, `/branches`, `/departments`, `/business-units`, `/locations`, `/cost-centers`, `/profit-centers`, `/organization` (tree), `/auth/context` |
| **Integrations** | Scope validation for Master Data, Finance, Sales; Foundation `sec_user_org_scope` |

### 3.3 Master Data (Sprint 3)

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Shared reference and party masters used across commercial and financial processes |
| **Status** | **Complete** - Stable |
| **Schema** | `master` |
| **Database tables** | `master_uom`, `master_currency`, `master_tax`, `master_product_category`, `master_employee`, `master_customer`, `master_vendor`, `master_product`, `master_warehouse`, `master_asset` |
| **APIs** | `/uoms`, `/currencies`, `/taxes`, `/product-categories`, `/employees`, `/customers`, `/vendors`, `/products`, `/warehouses`, `/assets` |
| **Integrations** | Referenced by Finance (AR/AP, assets) and Sales (customer, product, warehouse reference); employee FK cross-links (migration `0020`) |

### 3.4 Finance (Sprint 4)

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Core accounting: COA, fiscal periods, journals, GL posting, AR/AP subledgers, tax register, FX, asset accounting transactions |
| **Status** | **Complete** - Stable (budgeting & bank reconciliation deferred) |
| **Schema** | `finance` |
| **Database tables** | `fin_account_group`, `fin_chart_of_account`, `fin_fiscal_year`, `fin_period`, `fin_currency_rate`, `fin_journal_header`, `fin_journal_line`, `fin_gl_entry`, `fin_customer_ledger`, `fin_vendor_ledger`, `fin_tax_register`, `fin_cost_center_allocation`, `fin_asset_transaction` |
| **APIs** | `/finance/account-groups`, `/finance/chart-of-accounts`, `/finance/fiscal-years`, `/finance/periods`, `/finance/journals`, `/finance/gl`, `/finance/ar`, `/finance/ap`, `/finance/tax-register`, `/finance/currency-rates`, `/finance/asset-transactions`, `/finance/reports` |
| **Integrations** | Master Data (customer/vendor/asset); Organization (company/branch/CC); Foundation workflows & SoD; Sales posting via `PostingService.post_system_journal` |

### 3.5 Sales (Sprint 5)

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Order-to-Cash: price lists, discounts, customer credit, quotation → order → delivery → invoice → return |
| **Status** | **Complete** - Stable (CRM / inventory stock movement deferred) |
| **Schema** | `sales` |
| **Database tables** | `sales_price_list`, `sales_price_list_item`, `sales_discount_rule`, `sales_customer_credit`, `sales_quotation_header/line`, `sales_order_header/line`, `sales_delivery_header/line`, `sales_invoice_header/line`, `sales_return_header/line` (**14 tables**) |
| **APIs** | `/sales/price-lists`, `/sales/discount-rules`, `/sales/customer-credit`, `/sales/quotations`, `/sales/orders`, `/sales/deliveries`, `/sales/invoices`, `/sales/returns` |
| **Integrations** | Master Data (customer/product); Organization scope; Foundation RBAC/workflow/audit; Finance AR + system journal posting and credit exposure updates; Celery task stubs for expiry, credit recalc, posting retry, payment sync |

---

## 4. Database Baseline

### 4.1 PostgreSQL Schemas (7)

| Schema | Module / Concern |
|--------|------------------|
| `foundation` | Security, workflow, notifications |
| `audit` | Audit log / events |
| `config` | Tenant settings |
| `organization` | Org hierarchy |
| `master` | Master data |
| `finance` | Accounting |
| `sales` | Sales / O2C |

### 4.2 Migrations

| Metric | Value |
|--------|--------|
| **Total Alembic revisions applied (chain)** | **55** (`0001` … `0055`) |
| **Current Alembic head** | **`0055_seed_sales_workflows`** |
| **Sprint 5 range** | `0039_create_sales_schema` → `0055_seed_sales_workflows` |
| **Governance** | Alembic-only schema changes; soft delete; UUID PKs; DBS naming |

### 4.3 Cross-Module Relationships (Summary)

| From | To | Pattern |
|------|----|---------|
| All transactional modules | Foundation | `tenant_id`; workflow instance IDs; audit |
| Master / Finance / Sales | Organization | `company_id`, `branch_id` (+ CC where applicable) |
| Finance AR/AP | Master | `customer_id` / `vendor_id` |
| Sales documents | Master | `customer_id`, `product_id`; warehouse as UUID reference |
| Sales invoice/return post | Finance | `fin_customer_ledger` + system `fin_journal_*` / GL; ledger/journal IDs stored on sales headers |
| Organization / Foundation | Master employee | Cross-module FK where approved (`0020`) |

Logical schema ownership is preserved: modules do not create tables in another module’s schema.

---

## 5. API Baseline

### 5.1 API Groups (mounted under v1)

| Group | Prefix / Area |
|-------|----------------|
| Health | Health checks |
| Foundation | Auth, tenants, users, RBAC, workflows, notifications, audit, settings |
| Organization | Companies, hierarchy, org tree, auth context |
| Master Data | UOM, currency, tax, categories, employees, customers, vendors, products, warehouses, assets |
| Finance | COA, fiscal, journals, GL, AR, AP, tax register, FX, asset txns, reports |
| Sales | Pricing, credit, quotations, orders, deliveries, invoices, returns |

**Total major API groups:** **6** (Health + 5 domain modules).

### 5.2 Major Endpoint Categories

- Authentication & session (JWT login/refresh)
- Tenant / user / role / permission administration
- Workflow submit / approve / reject
- Organizational CRUD and tree/context
- Master data CRUD with scope and uniqueness rules
- Finance journal lifecycle and posting; AR/AP entries
- Sales O2C document lifecycle including invoice/return post

### 5.3 OpenAPI Status

| Item | Status |
|------|--------|
| FastAPI auto OpenAPI | **Enabled** (`create_app()` → FastAPI metadata) |
| Swagger UI | **Available** at standard FastAPI `/docs` |
| ReDoc | **Available** at `/redoc` (FastAPI default) |
| Contract style | Pydantic v2 request/response models; `APIResponse` envelope |

---

## 6. Quality Baseline

| Gate | Status | Notes |
|------|--------|--------|
| **Alembic** | **PASS** | Head `0055_seed_sales_workflows`; Sprint 5 migrations applied including permission seed fix (`status='active'` on `sec_role`) |
| **FastAPI startup** | **PASS** | Application factory and router wiring verified in implementation baseline |
| **Swagger** | **PASS** | OpenAPI docs served by FastAPI |
| **Ruff** (`ruff check src`) | **PASS** | All checks passed |
| **Mypy** (`mypy src`) | **Conditional PASS for production** | Production packages under Architecture Lock; **current Mypy issues are limited to test stub typing** (`no-untyped-call` / stub vs ORM types in sales tests) and **do not affect production modules** |
| **Pytest** (`pytest src/tests`) | **PASS** | **77 passed** (unit, integration-style, security) |

---

## 7. Security Baseline

| Control | Implementation Status |
|---------|------------------------|
| **JWT** | Access/refresh tokens; session tracking (`sec_session`, `sec_refresh_token`) |
| **RBAC** | `sec_role` / `sec_permission` / grants; module permission seeds (Foundation, Org, Master, Finance, Sales) |
| **Tenant isolation** | `tenant_id` on multi-tenant entities; repository scoping |
| **Company / branch isolation** | Org scope validators; `sec_user_org_scope`; company/branch checks in Finance/Sales |
| **Audit** | `audit_log` / `audit_event`; service-level entity change logging |
| **Workflow** | `wf_*` definitions/instances/actions; module-specific approval codes; SoD on approve/post paths |
| **SoD** | Creator cannot approve own quotation/invoice/return; journal post SoD with exception for **system** journals used by Sales posting |

---

## 8. Deferred Features

Approved deferred / out-of-scope items relative to this alpha core (documented in ERD / Architecture Lock domain roadmap):

| Deferred Capability | Reference / Rationale |
|---------------------|------------------------|
| **Budgeting** (`fin_budget_*`) | ERD_04 Finance - Phase 2 / separate ERD |
| **Bank Reconciliation** (`fin_bank_*`) | ERD_04 Finance - out of Sprint 4 scope |
| **Inventory stock movement** | Sales uses warehouse UUID reference only; Inventory domain FRD-08 / Sprint 7 |
| **CRM** (`crm_*` leads/opportunities) | ERD_05 / FRD-05; quotation holds optional `opportunity_reference` only |
| **Manufacturing** | FRD-13 - later supply-chain track |
| **Payroll** | FRD-10 - after HR |
| Dedicated sales **contract management** tables | Modeled via contract price lists for now |
| Full Celery job bodies for Sales | Stubs registered; operational hardening later |
| Frontend Next.js application delivery | Locked stack; not part of this backend alpha baseline |

---

## 9. Release Metrics

| Metric | Value |
|--------|--------|
| **Infrastructure Phase** | **Sprint 0** |
| **Delivery Sprints** | **Sprint 1-5** (Foundation, Organization, Master Data, Finance, Sales) |
| **Overall milestones completed** | **6** (Sprint 0 + Sprints 1-5) |
| **Total implemented domain modules** | **5** (Foundation, Organization, Master Data, Finance, Sales) |
| **Total database schemas** | **7** |
| **Total documented ERDs** | **5** (`ERD_01` … `ERD_05`) |
| **Total Alembic revisions** | **55** |
| **Current Alembic head** | **`0055_seed_sales_workflows`** |
| **Business tables** | **Approximately 63 business tables** across implemented modules |
| **Test status** | **77 passed** |
| **Architecture Lock** | **v1.1 Maintained** |
| **FRD domains documented** | **22** (+ Master FRD); **5** implemented in code |

---

## 10. Next Roadmap

Recommended implementation order (Architecture Lock commercial/supply/people tracks; foundation dependencies already satisfied):

| Sprint | Module | Primary FRD | Dependency Notes |
|--------|--------|-------------|------------------|
| **Sprint 6** | **Procurement** | FRD-07 | Vendor master + Finance AP; no inventory stock required for PO/receipt design gates as scoped |
| **Sprint 7** | **Inventory** | FRD-08 | Warehouse master exists; stock movements; Sales/Procurement fulfillment |
| **Sprint 8** | **HR** | FRD-09 | Employee master exists; org hierarchy |
| **Sprint 9** | **Payroll** | FRD-10 | Requires HR |
| **Sprint 10** | **CRM** | FRD-05 | Customer master exists; handoff to Sales quotations |

Subsequent candidates (not sequenced in this alpha gate): Manufacturing, Quality, SCM, Asset Management (ops), Projects, BI, DMS, Compliance, Integration Hub, E-Commerce.

---

## 11. Release Approval

| Field | Value |
|-------|--------|
| **Release Name** | ERP Core v1.0-alpha |
| **Release Status** | Stable Development Baseline |
| **Architecture Lock** | Maintained (v1.1) |
| **Database Head** | `0055_seed_sales_workflows` |
| **Quality Gate Summary** | Alembic PASS · Ruff PASS · Pytest PASS · Mypy production-clean (test stubs only) |
| **Ready for** | **Sprint 6 Development** |

### Approval Checklist

- [x] Architecture Lock v1.1 not violated
- [x] Router → Service → Repository → Database enforced in delivered modules
- [x] DBS naming / Alembic governance followed
- [x] ERDs 01-05 aligned with implemented schemas
- [x] Cross-module integrations limited to approved service boundaries
- [x] Deferred features explicitly listed (no silent scope creep)
- [ ] Formal EARB / Product sign-off (organizational process)

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-13 | Initial ERP Core v1.0-alpha baseline after Sprint 5 |

---

**ERP Core v1.0-alpha baseline completed and ready for release approval.**
