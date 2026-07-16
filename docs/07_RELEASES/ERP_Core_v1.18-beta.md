# ERP Core v1.18-beta — Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.18-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 — Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal — Confidential |
| **Predecessor** | [ERP Core v1.17-beta](./ERP_Core_v1.17-beta.md) |
| **Ready For** | Sprint 24 — Next domain per ERP roadmap |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.18-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-16 |
| **Previous Release** | ERP Core v1.17-beta |
| **Architecture Lock** | v1.1 — Preserved |
| **Recommended Git Tag** | `v1.18-beta` |

---

## 2. Sprint 23 Highlights

Sprint 23 delivered the **Customer Portal & Self-Service Portal** domain (ERD_23) as the enterprise external customer self-service layer — portal accounts → customer profiles → sessions → dashboards / widgets → notifications / messages / threads → order views → invoice views → document access → support tickets → service requests → download history → saved reports / searches → preferences → devices → login audit → reports — while **existing masters remain authoritative (C-01)**. No duplicate employee / customer / product / vendor / department masters. This module **provides secure self-service access** and **never becomes the system of record**: **CRM remains customer relationship authority**, **Sales remains order authority**, **Finance remains invoice / accounting authority**, **Document remains document authority**, **Helpdesk remains ticket authority**, **Service remains request authority**, **Analytics** remains read-only, **Integration Hub** owns external portal / IdP / API transport (UUID / API only), and **E-Commerce** is optional channel UUID only. Peer bindings use **UUID / services only** — **no peer ORM writes**. Finance journals use **`PostingService.post_system_journal()`** only — **no `fin_*` ORM writes**.

| Capability | Delivery |
|------------|----------|
| **Customer Portal Module** | `apps/api/src/modules/portal/` — Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Portal Accounts** | External login identities bound to `master_customer` with submit / approve |
| **Customer Profiles** | Self-service profile surface (CRM = relationship authority) |
| **Portal Sessions** | Authenticated session lifecycle |
| **Dashboards** | Customer / manager portal dashboards |
| **Dashboard Widgets** | Configurable dashboard widgets |
| **Notifications** | Portal operational notifications |
| **Messages** | Customer ↔ support message bodies |
| **Message Threads** | Conversation threads (parent of messages) |
| **Order Views** | Projected / cached Sales order views (`sales_order_id` UUID) |
| **Invoice Views** | Projected / cached Finance invoice views |
| **Document Access** | Document grant envelopes (`document_id` UUID) with submit / approve |
| **Support Tickets** | Portal ticket envelopes mapped to Helpdesk UUID |
| **Service Requests** | Portal request envelopes mapped to Service UUID |
| **Download History** | Document download audit trail |
| **Saved Reports** | User-saved report bookmarks |
| **Saved Searches** | User-saved search criteria |
| **Preferences** | Locale / UX preference rows |
| **Devices** | Registered portal devices |
| **Login Audit** | Login / logout / failure audit trail |
| **Reports** | Portal operational reports |
| **Engines (20)** | PortalAccount · CustomerProfile · PortalSession · Dashboard · DashboardWidget · Notification · MessageThread · Message · OrderView · InvoiceView · DocumentAccess · SupportTicket · ServiceRequest · DownloadHistory · SavedReport · SavedSearch · Preference · Device · LoginAudit · PortalReport |

**Services:** `PortalApplicationService`, `PortalAccountService`, `CustomerProfileService`, `PortalSessionService`, `DashboardService`, `DashboardWidgetService`, `NotificationService`, `MessageThreadService`, `MessageService`, `OrderViewService`, `InvoiceViewService`, `DocumentAccessService`, `SupportTicketService`, `ServiceRequestService`, `DownloadHistoryService`, `SavedReportService`, `SavedSearchService`, `PreferenceService`, `DeviceService`, `LoginAuditService`, `PortalReportService`, **`PortalIntegrationService`**, **`PortalNumberService`**.

**Supporting delivered items:** document numbering (`ACC-` / `PRF-` / `SES-` / `DSH-` / `MSG-` / `THR-` / `ORD-` / `INV-` / `DOC-` / `TKT-` / `SRQ-` / `DL-` / `SVR-` / `SVS-` / `DEV-` / `AUD-` / `RPT-`), Celery jobs (`session_expiry_sweeper`, `order_view_sync`, `invoice_view_sync`, `notification_dispatcher`, `login_audit_retention`, `ticket_status_poller`), RBAC roles (`PORTAL_ADMIN`, `PORTAL_MANAGER`, `CUSTOMER_USER`, `SUPPORT_USER`), and workflows (`PT_ACCOUNT_APPROVAL`, `PT_PROFILE_APPROVAL`, `PT_DOCUMENT_ACCESS`, `PT_SUPPORT_REQUEST`, `PT_SERVICE_REQUEST`).

---

## 3. Customer Portal & Self-Service Portal Module

| Item | Value |
|------|--------|
| **Schema** | `portal` |
| **Prefix** | `pt_` |
| **Business Tables** | **20** |
| **ERD** | ERD_23 Customer Portal & Self-Service Portal (locked) |
| **API mount** | `/api/v1/portal` |

**Tables:** `pt_portal_account`, `pt_customer_profile`, `pt_portal_session`, `pt_dashboard`, `pt_dashboard_widget`, `pt_notification`, `pt_message_thread`, `pt_message`, `pt_order_view`, `pt_invoice_view`, `pt_document_access`, `pt_support_ticket`, `pt_service_request`, `pt_download_history`, `pt_saved_report`, `pt_saved_search`, `pt_preference`, `pt_device`, `pt_login_audit`, `pt_report`.

**Coverage:** portal accounts · customer profiles · portal sessions · dashboards · dashboard widgets · notifications · message threads · messages · order views · invoice views · document access · support tickets · service requests · download history · saved reports · saved searches · preferences · devices · login audit · reports.

**API mount:** `/api/v1/portal` — portal-accounts (+ submit / approve), customer-profiles (+ submit / approve), portal-sessions, dashboards, dashboard-widgets, notifications, message-threads, messages, order-views, invoice-views, document-accesses (+ submit / approve), support-tickets (+ submit), service-requests (+ submit), download-histories, saved-reports, saved-searches, preferences, devices, login-audits, reports.

---

## 4. Cross Module Integrations

Customer Portal **never** duplicates employee, customer, product, vendor, or department masters. **Existing masters remain authoritative (C-01)**. **CRM remains customer relationship authority**. **Sales remains order authority**. **Finance remains invoice authority**. **Document remains document authority**. **Helpdesk remains ticket authority**. **Service remains request authority**. Peers communicate via **services · events · REST / webhooks (Integration Hub) · UUID refs** — **never** via direct ORM writes outside `pt_*`. Finance journals use **`PostingService.post_system_journal()`** only — **no `fin_*` ORM writes**. Analytics remains **read-only**. Integration Hub is **UUID / API only**. **No duplicate masters**. **No peer ORM writes**.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_employee` · `master_customer` · `master_product` (C-01)** — **no duplicate masters** |
| **Organization** | **`org_department` only** — no Portal department master |
| **CRM** | **Customer relationship authority** — optional interaction UUID — **no `crm_*` ORM writes** |
| **Sales** | **Order authority** — `pt_order_view.sales_order_id` UUID only — **no `sales_*` ORM writes** |
| **Finance** | **Invoice authority** + **`PostingService.post_system_journal()`** — store `finance_journal_id` — **no `fin_*` writes** |
| **Document** | **Document authority** — access / download store `document_id` UUID — **no Document ORM writes** |
| **Helpdesk** | **Ticket authority** — portal ticket → helpdesk UUID via service — **no Helpdesk ORM writes** |
| **Service** | **Request authority** — portal request → service UUID via service — **no Service ORM writes** |
| **Analytics** | **Read-only** consumer of portal metrics — **no Analytics ORM writes** |
| **Integration Hub** | External portal / IdP / API **REST · events · webhooks** — connector / system UUID refs only |
| **E-Commerce** | Optional channel order UUID — **not portal SoR** — **no peer ORM writes** |
| **Foundation** | **Workflow** (`PT_ACCOUNT_APPROVAL`, `PT_PROFILE_APPROVAL`, `PT_DOCUMENT_ACCESS`, `PT_SUPPORT_REQUEST`, `PT_SERVICE_REQUEST`); **RBAC** (`portal.*` permissions; roles `PORTAL_ADMIN`, `PORTAL_MANAGER`, `CUSTOMER_USER`, `SUPPORT_USER` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **1637** |
| **OpenAPI Paths** | **1026** |
| **Portal Routes** | **89** |
| **Portal OpenAPI Paths** | **49** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; Customer Portal APIs are visible under `/api/v1/portal/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0442_seed_portal_workflows` |
| **Migration range (this release delta)** | `0421_create_portal_schema` → `0442_seed_portal_workflows` |
| **Approximate business tables** | Approximately **408** (~388 at v1.17-beta + 20 Customer Portal) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `payroll`, `recruitment`, `project`, `asset`, `service`, `helpdesk`, `document`, `grc`, `analytics`, `integration`, `ecommerce`, **`portal`** (**25**) |

```text
0421_create_portal_schema
        ↓
0442_seed_portal_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** — head `0442_seed_portal_workflows` |
| **FastAPI Startup** | **PASS** — Application startup complete (validated on port **8033**; port 8000 unavailable) |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (2146 files)** |
| **Pytest** | **PASS (297)** |

Validation completed successfully. Head `0442_seed_portal_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and Customer Portal routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| CHECK constraints | `pt_preference` / `pt_login_audit` single-value status checks rewritten to `=` form (trailing-comma `IN` hazard) |
| `PortalDocumentAdapter` | Added `__init__(self, db: Session)` for MyPy call-arg |
| Portal import test | Ruff `--fix` import sort (I001) |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** — no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required portal wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | Customer Portal domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/portal` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed — Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · Helpdesk · Document · GRC · Analytics · Integration · E-Commerce untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 24 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.19-beta** (planned) |
| **Sprint** | **Sprint 24 — Next domain per ERP roadmap** |
| **Primary domain** | Per ERP product roadmap (post ERD_23) |

**Planned scope (planning only — no implementation in this release):**

- Next enterprise domain per approved ERP roadmap / FRD sequence
- Continuity with Master Data party / product masters (C-01)
- Optional cross-links to Customer Portal · E-Commerce · Integration Hub · Sales · Finance via UUID / services only
- No redesign of Customer Portal · E-Commerce · Integration Hub · Finance modules

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.18-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` · `v1.7-beta` · `v1.8-beta` · `v1.9-beta` · `v1.10-beta` · `v1.11-beta` · `v1.12-beta` · `v1.13-beta` · `v1.14-beta` · `v1.15-beta` · `v1.16-beta` · `v1.17-beta` unchanged |
| **Version** | **ERP Core v1.18-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · Helpdesk · Document · GRC · Analytics · Integration · E-Commerce · **Customer Portal** |
| **Alembic head** | **`0442_seed_portal_workflows`** |
| **Tests** | **297 passed** |
| **Routes** | **1637** FastAPI · **1026** OpenAPI · **89** Portal · **49** Portal OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest — **ALL PASS** |
| **Next** | **Sprint 24 — Next domain per ERP roadmap** |
| **Ready for Git Tag** | **`v1.18-beta`** |

---

## 11. Version Timeline

| Version | Date | Scope | Alembic Head | Tests |
|---------|------|--------|--------------|-------|
| **v1.0-alpha** | 2026-07-13 | Sprints 0–5 (Foundation → Sales) | `0055_seed_sales_workflows` | 77 passed |
| **v1.1-beta** | 2026-07-13 | Sprints 0–6 (+ Procurement P2P) | `0077_seed_proc_workflows` | 99 passed |
| **v1.2-beta** | 2026-07-13 | Sprints 0–7 (+ Inventory & Warehouse) | `0094_seed_inv_workflows` | 113 passed |
| **v1.3-beta** | 2026-07-14 | Sprints 0–8 (+ Manufacturing & Production) | `0114_seed_mfg_workflows` | 127 passed |
| **v1.4-beta** | 2026-07-14 | Sprints 0–9 (+ Quality Management) | `0135_seed_qm_workflows` | 146 passed |
| **v1.5-beta** | 2026-07-14 | Sprints 0–10 (+ CRM) | `0156_seed_crm_workflows` | 158 passed |
| **v1.6-beta** | 2026-07-14 | Sprints 0–11 (+ HRMS) | `0178_seed_hr_workflows` | 169 passed |
| **v1.7-beta** | 2026-07-14 | Sprints 0–12 (+ Payroll) | `0200_seed_payroll_workflows` | 179 passed |
| **v1.8-beta** | 2026-07-14 | Sprints 0–13 (+ Recruitment) | `0222_seed_recruitment_workflows` | 189 passed |
| **v1.9-beta** | 2026-07-14 | Sprints 0–14 (+ Project) | `0244_seed_project_workflows` | 199 passed |
| **v1.10-beta** | 2026-07-14 | Sprints 0–15 (+ Asset) | `0266_seed_asset_workflows` | 209 passed |
| **v1.11-beta** | 2026-07-15 | Sprints 0–16 (+ Service) | `0288_seed_service_workflows` | 219 passed |
| **v1.12-beta** | 2026-07-15 | Sprints 0–17 (+ Helpdesk) | `0310_seed_helpdesk_workflows` | 230 passed |
| **v1.13-beta** | 2026-07-15 | Sprints 0–18 (+ Document / DMS) | `0332_seed_document_workflows` | 241 passed |
| **v1.14-beta** | 2026-07-15 | Sprints 0–19 (+ GRC) | `0354_seed_grc_workflows` | 253 passed |
| **v1.15-beta** | 2026-07-15 | Sprints 0–20 (+ Analytics / BI) | `0376_seed_analytics_workflows` | 266 passed |
| **v1.16-beta** | 2026-07-15 | Sprints 0–21 (+ Integration Hub) | `0398_seed_integration_workflows` | 276 passed |
| **v1.17-beta** | 2026-07-15 | Sprints 0–22 (+ E-Commerce / External Channel) | `0420_seed_ecommerce_workflows` | 287 passed |
| **v1.18-beta** | 2026-07-16 | Sprints 0–23 (+ Customer Portal & Self-Service) | `0442_seed_portal_workflows` | 297 passed |

```text
v1.17-beta ──(+ Sprint 23 Customer Portal & Self-Service)──► v1.18-beta ──► Sprint 24 (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-16 | Initial ERP Core v1.18-beta release notes after Sprint 23 validation |

---

**Confirmations**

- `ERP_Core_v1.18-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.18-beta`**
- Ready to begin Sprint 24 planning

**ERP Core v1.18-beta release documentation completed and ready for release approval.**
