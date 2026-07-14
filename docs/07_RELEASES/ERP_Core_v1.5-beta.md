# ERP Core v1.5-beta — Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.5-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 — Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal — Confidential |
| **Predecessor** | [ERP Core v1.4-beta](./ERP_Core_v1.4-beta.md) |
| **Ready For** | Sprint 11 — Human Resource Management (HRMS) |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.5-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-14 |
| **Previous Release** | ERP Core v1.4-beta |
| **Architecture Lock** | v1.1 — Preserved |
| **Recommended Git Tag** | `v1.5-beta` |

---

## 2. Sprint 10 Highlights

Sprint 10 delivered the **CRM (Customer Relationship Management)** domain (FRD-05 / ERD_10) as the enterprise customer-relationship layer — without duplicating `master_customer` (C-01) and without writing Sales, Finance, or Quality tables directly.

| Capability | Delivery |
|------------|----------|
| **CRM Module** | `apps/api/src/modules/crm/` — Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Lead Management** | Lead capture, qualification fields, convert lifecycle |
| **Lead Assignment** | Manual / automatic assignment trail with supersede |
| **Lead Activities** | Call, meeting, email, task, follow-up, note activity log |
| **Pipelines** | Funnel template master with stage metadata |
| **Opportunities** | Revenue, probability, forecast; close won / lost |
| **Opportunity Stage History** | Append-oriented stage transitions |
| **Campaigns · Campaign Members** | Marketing campaigns; lead / customer membership (XOR) |
| **Customer Interactions** | Unified interaction history across lead / opportunity / customer |
| **Tasks · Follow-ups · Meetings** | Sales execution and scheduling lifecycles |
| **Call · Email · Visit Logs** | Channel-level communication and visit records |
| **Customer Feedback · Satisfaction** | Voice-of-customer feedback and CSAT / NPS publish snapshots |
| **Engines (17)** | Lead · LeadAssignment · LeadActivity · Opportunity · OpportunityStage · Pipeline · Campaign · CampaignMember · Interaction · Task · Followup · Meeting · CallLog · EmailLog · VisitLog · Feedback · CustomerSatisfaction |

**Services:** `CRMApplicationService`, `LeadService` / lead source · assignment · activity services, `OpportunityService` / `PipelineService` / stage service, `CampaignService`, `InteractionService`, `TaskService`, `FollowupService`, `MeetingService`, call / email / visit log services, `FeedbackService`, `CustomerSatisfactionService`, `CRMReportService`, **`CRMIntegrationService`**.

**Supporting delivered items:** document numbering (`LEAD` / `OPP` / `CMP` / `PIPE` / `TSK` / `FU` / `MTG` / `INT` / `FBK`), Celery jobs (lead follow-up reminders, stale lead alerts, opportunity close reminders, campaign end notifications, satisfaction refresh, Sales conversion retry), RBAC roles (`CRM_SALES_REP`, `CRM_SALES_MANAGER`, `CRM_MARKETING`, `CRM_ADMIN`), and workflows (`CRM_LEAD_CONVERSION`, `CRM_OPPORTUNITY_CLOSE`, `CRM_CAMPAIGN_ACTIVATION`).

---

## 3. CRM Module

| Item | Value |
|------|--------|
| **Schema** | `crm` |
| **Prefix** | `crm_` |
| **Business Tables** | **18** |
| **ERD** | ERD_10 CRM (locked) |
| **FRD** | FRD-05 CRM Domain |

**Tables:** `crm_lead_source`, `crm_pipeline`, `crm_campaign`, `crm_lead`, `crm_lead_assignment`, `crm_lead_activity`, `crm_opportunity`, `crm_opportunity_stage`, `crm_campaign_member`, `crm_interaction`, `crm_task`, `crm_followup`, `crm_meeting`, `crm_call_log`, `crm_email_log`, `crm_visit_log`, `crm_customer_feedback`, `crm_customer_satisfaction`.

**API mount:** `/api/v1/crm` — lead-sources, leads (+ assign / convert), lead-assignments, lead-activities, pipelines, opportunities (+ close-won / close-lost), opportunity-stages, campaigns (+ activate / members), campaign-members, interactions, tasks, followups, meetings, call-logs, email-logs, visit-logs, customer-feedback, customer-satisfaction, reports.

---

## 4. Cross Module Integrations

CRM **never** duplicates customer master and **never** writes `sales_*`, finance, or `qm_*` tables. Cross-module orchestration uses approved application services and UUID refs only.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_customer` only (C-01)**; lead conversion via `CrmMasterDataAdapter` → `CustomerService`; no CRM customer / contact master table |
| **Sales** | Won opportunity → `CrmSalesAdapter` → `QuotationService`; CRM stores only `sales_quotation_id` / `sales_order_id` UUID — **no FK** to `sales_*` |
| **Finance** | Customer credit **read** via Sales `CustomerCreditService` only — never writes finance tables |
| **Quality** | Feedback / satisfaction may hold Quality UUID refs only — **no `qm_*` FK**; never writes quality tables |
| **Foundation** | **Workflow** (`CRM_LEAD_CONVERSION`, `CRM_OPPORTUNITY_CLOSE`, `CRM_CAMPAIGN_ACTIVATION`); **Audit** on lead / opportunity / campaign events; **RBAC** (`crm.*` permissions; roles `CRM_SALES_REP`, `CRM_SALES_MANAGER`, `CRM_MARKETING`, `CRM_ADMIN` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **497** |
| **OpenAPI Paths** | **344** |
| **CRM Routes** | **52** |
| **CRM OpenAPI Paths** | **34** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; CRM APIs are visible under `/api/v1/crm/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0156_seed_crm_workflows` |
| **Migration range (this release delta)** | `0136_create_crm_schema` → `0156_seed_crm_workflows` |
| **Approximate business tables** | Approximately **149** (~131 at v1.4-beta + 18 CRM) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, **`crm`** (**12**) |

```text
0136_create_crm_schema
        ↓
0156_seed_crm_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** — head `0156_seed_crm_workflows` |
| **FastAPI Startup** | **PASS** — Application startup complete |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS** |
| **Pytest** | **PASS (158)** |

Validation completed successfully. Head `0156_seed_crm_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and CRM routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| `0155_seed_crm_permissions.py` | Role-permission insert uses `granted_at` (aligned to `sec_role_permission`) |
| `modules/crm/routers/__init__.py` | `APIResponse` calls include required `message=` |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** — no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | CRM domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/crm` package; no service-boundary redesign |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 11 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.6-beta** (planned) |
| **Sprint** | **Sprint 11 — Human Resource Management (HRMS)** |
| **Primary FRD** | FRD-09 HR Domain (planned) |

**Planned scope (planning only — no implementation in this release):**

- Employee Management
- Departments
- Designations
- Attendance
- Leave Management
- Shift Management
- Holiday Calendar
- Payroll foundation
- Employee Documents
- Performance foundation

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.5-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` unchanged |
| **Version** | **ERP Core v1.5-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · **CRM** |
| **Alembic head** | **`0156_seed_crm_workflows`** |
| **Tests** | **158 passed** |
| **Routes** | **497** FastAPI · **344** OpenAPI · **52** CRM · **34** CRM OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest — **ALL PASS** |
| **Next** | **Sprint 11 — Human Resource Management (HRMS)** |
| **Ready for Git Tag** | **`v1.5-beta`** |

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

```text
v1.4-beta ──(+ Sprint 10 CRM)──► v1.5-beta ──► Sprint 11 HRMS (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-14 | Initial ERP Core v1.5-beta release notes after Sprint 10 validation |

---

**Confirmations**

- `ERP_Core_v1.5-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.5-beta`**
- Ready to begin Sprint 11 planning

**ERP Core v1.5-beta release documentation completed and ready for release approval.**
