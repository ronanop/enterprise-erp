# ERP Core v1.12-beta — Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.12-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 — Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal — Confidential |
| **Predecessor** | [ERP Core v1.11-beta](./ERP_Core_v1.11-beta.md) |
| **Ready For** | Sprint 18 — Document Management System (DMS) |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.12-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-15 |
| **Previous Release** | ERP Core v1.11-beta |
| **Architecture Lock** | v1.1 — Preserved |
| **Recommended Git Tag** | `v1.12-beta` |

---

## 2. Sprint 17 Highlights

Sprint 17 delivered the **Helpdesk & Customer Support** domain (FRD-17 / ERD_17) as the centralized ticket, SLA, and knowledge layer — issue reported → ticket → assignment → investigation → resolution → feedback — while **existing masters remain authoritative (C-01)**. No duplicate customer / employee / department masters. Chargeable resolution posting occurs only through Finance `PostingService.post_system_journal()`, storing `finance_journal_id` UUID references only. Service / CRM / Project / Asset / Inventory / Quality / Manufacturing peer context uses UUID-only refs with **no peer ORM writes**.

| Capability | Delivery |
|------------|----------|
| **Helpdesk Module** | `apps/api/src/modules/helpdesk/` — Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Ticket Categories** | Domain catalog for incident / request classification (not a master identity) |
| **Ticket Priorities** | Ranked priority catalog with SLA timing defaults |
| **Tickets** | Central support ticket register with submit / approve — FRD-17 §4 |
| **Ticket Assignments** | Agent dispatch with submit / approve / complete |
| **Status History** | Ticket status transition ledger |
| **Comments** | Public / internal ticket collaboration |
| **Attachments** | Ticket / comment file metadata (URI / hash) |
| **Activities** | Timeline of ticket events |
| **SLA** | Response / resolution policy definitions |
| **Escalations** | SLA / management escalations with workflow |
| **Knowledge Base** | Knowledge container catalog |
| **Knowledge Articles** | Article authoring with submit / approve / publish |
| **Resolutions** | Closure / first-time-fix with completion workflow |
| **Customer Feedback** | CSAT rating capture |
| **Support Teams** | Queue / team registry |
| **Support Shifts** | Shift windows under teams |
| **Support Schedules** | Agent schedule rows (team + shift) |
| **Notifications** | Helpdesk-scoped notification delivery ledger |
| **Reports** | Volume / SLA / FTR / backlog snapshots |
| **Dashboards** | Cached KPI / widget layouts |
| **Engines (20)** | TicketCategory · TicketPriority · Ticket · TicketAssignment · TicketStatusHistory · TicketComment · TicketAttachment · TicketActivity · TicketSLA · TicketEscalation · KnowledgeBase · KnowledgeArticle · Resolution · CustomerFeedback · SupportTeam · SupportShift · SupportSchedule · TicketNotification · TicketReport · TicketDashboard |

**Services:** `HelpdeskApplicationService`, `TicketCategoryService`, `TicketPriorityService`, `TicketService`, `TicketAssignmentService`, `TicketStatusHistoryService`, `TicketCommentService`, `TicketAttachmentService`, `TicketActivityService`, `TicketSLAService`, `TicketEscalationService`, `KnowledgeBaseService`, `KnowledgeArticleService`, `ResolutionService`, `CustomerFeedbackService`, `SupportTeamService`, `SupportShiftService`, `SupportScheduleService`, `TicketNotificationService`, `HelpdeskReportService`, `HelpdeskDashboardService`, **`HelpdeskIntegrationService`**.

**Supporting delivered items:** document numbering (`TKT` / `HDAS` / `HDES` / `HDKA` / `HDRES` / `HDSS`), Celery jobs (`sla_monitor`, `ticket_assignment_reminders`, `ticket_escalation_monitor`, `knowledge_review_reminders`, `customer_feedback_followups`, `retry_finance_posting`), RBAC roles (`HELPDESK_AGENT`, `HELPDESK_MANAGER`, `SUPPORT_ENGINEER`, `HELPDESK_ADMIN`), and workflows (`HD_TICKET_APPROVAL`, `HD_ASSIGNMENT_APPROVAL`, `HD_SLA_ESCALATION`, `HD_RESOLUTION_APPROVAL`, `HD_KNOWLEDGE_APPROVAL`).

---

## 3. Helpdesk Module

| Item | Value |
|------|--------|
| **Schema** | `helpdesk` |
| **Prefix** | `hd_` |
| **Business Tables** | **20** |
| **ERD** | ERD_17 Helpdesk (locked) |
| **FRD** | FRD-17 Helpdesk & Customer Support |
| **API mount** | `/api/v1/helpdesk` |

**Tables:** `hd_ticket_category`, `hd_ticket_priority`, `hd_ticket`, `hd_ticket_assignment`, `hd_ticket_status_history`, `hd_ticket_comment`, `hd_ticket_attachment`, `hd_ticket_activity`, `hd_ticket_sla`, `hd_ticket_escalation`, `hd_knowledge_base`, `hd_knowledge_article`, `hd_resolution`, `hd_customer_feedback`, `hd_support_team`, `hd_support_shift`, `hd_support_schedule`, `hd_ticket_notification`, `hd_ticket_report`, `hd_ticket_dashboard`.

**Coverage:** categories · priorities · tickets · assignments · status history · comments · attachments · activities · SLA · escalations · knowledge bases · articles · resolutions · feedback · teams · shifts · schedules · notifications · reports · dashboards.

**API mount:** `/api/v1/helpdesk` — ticket-categories, ticket-priorities, tickets (+ submit / approve), ticket-assignments (+ submit / approve / complete), ticket-status-history, ticket-comments, ticket-attachments, ticket-activities, ticket-slas, ticket-escalations (+ escalate), knowledge-bases, knowledge-articles (+ submit / approve / publish), resolutions (+ submit / complete), customer-feedback, support-teams, support-shifts, support-schedules, ticket-notifications, ticket-reports, ticket-dashboards.

---

## 4. Cross Module Integrations

Helpdesk **never** duplicates customer, employee, or department masters. **Existing masters remain authoritative (C-01)**. Peer domains are consumed via FKs, service adapters, or UUID-only references — **never** via direct ORM writes outside `hd_*`.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_customer` · `master_employee` only (C-01)** — **no duplicate masters** |
| **Organization** | **`org_department` only** — no helpdesk department master |
| **Finance** | Store **`finance_journal_id` UUID only**; posting **only** through `PostingService.post_system_journal()` — **no direct `fin_*` writes** |
| **Service** | Optional `service_request_id` / `service_ticket_id` / `work_order_id` **UUID only** — **no `svc_*` FK / no writes** |
| **CRM** | Optional `crm_opportunity_id` / `crm_customer_id` **UUID only** — **no FK / no writes** |
| **Project** | Optional `project_id` **UUID only** — **no FK / no writes** |
| **Asset** | Optional `asset_id` **UUID only** — **no `ast_*` FK / no writes** |
| **Inventory** | Optional `inventory_issue_id` **UUID only** — **no FK / no writes** |
| **Quality** | Optional `quality_case_id` **UUID only** — **no FK / no writes** |
| **Manufacturing** | Optional `production_order_id` **UUID only** — **no FK / no writes** |
| **HR** | Employee refs via Master Data — **read only / no `hr_*` writes** |
| **Payroll** | Optional labor cost **read** — **no `pay_*` writes** |
| **Recruitment** | **No writes** |
| **Foundation** | **Workflow** (`HD_TICKET_APPROVAL`, `HD_ASSIGNMENT_APPROVAL`, `HD_SLA_ESCALATION`, `HD_RESOLUTION_APPROVAL`, `HD_KNOWLEDGE_APPROVAL`); **RBAC** (`helpdesk.*` permissions; roles `HELPDESK_AGENT`, `HELPDESK_MANAGER`, `SUPPORT_ENGINEER`, `HELPDESK_ADMIN` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **1075** |
| **OpenAPI Paths** | **704** |
| **Helpdesk Routes** | **91** |
| **Helpdesk OpenAPI Paths** | **51** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; Helpdesk APIs are visible under `/api/v1/helpdesk/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0310_seed_helpdesk_workflows` |
| **Migration range (this release delta)** | `0289_create_helpdesk_schema` → `0310_seed_helpdesk_workflows` |
| **Approximate business tables** | Approximately **288** (~268 at v1.11-beta + 20 Helpdesk) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `payroll`, `recruitment`, `project`, `asset`, `service`, **`helpdesk`** (**19**) |

```text
0289_create_helpdesk_schema
        ↓
0310_seed_helpdesk_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** — head `0310_seed_helpdesk_workflows` |
| **FastAPI Startup** | **PASS** — Application startup complete (validated on port **8030**; ports 8000 / 8010 / 8020 unavailable) |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (1465 files)** |
| **Pytest** | **PASS (230)** |

Validation completed successfully. Head `0310_seed_helpdesk_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and Helpdesk routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| Index name collision | Explicit indexes on `HdTicket.sla_status` / `HdTicketSla.status` to avoid shared default name `ix_helpdesk_hd_ticket_sla_status` |
| Workflow seed SQL | Align `0310_seed_helpdesk_workflows` to Service seed pattern (`is_parallel` on `wf_step`; no `is_parallel` on `wf_definition`) |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** — no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | Helpdesk domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/helpdesk` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed — Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 18 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.13-beta** (planned) |
| **Sprint** | **Sprint 18 — Document Management System (DMS)** |
| **Primary domain** | **Document Management System** (FRD-19) |

**Planned scope (planning only — no implementation in this release):**

- Document repository / versioning / metadata foundation
- Continuity with Master Data party / employee masters (C-01)
- Optional cross-links to Helpdesk · Service · Project via UUID / services only
- No redesign of Helpdesk · Service · Asset · Project modules

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.12-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` · `v1.7-beta` · `v1.8-beta` · `v1.9-beta` · `v1.10-beta` · `v1.11-beta` unchanged |
| **Version** | **ERP Core v1.12-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · **Helpdesk** |
| **Alembic head** | **`0310_seed_helpdesk_workflows`** |
| **Tests** | **230 passed** |
| **Routes** | **1075** FastAPI · **704** OpenAPI · **91** Helpdesk · **51** Helpdesk OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest — **ALL PASS** |
| **Next** | **Sprint 18 — Document Management System (DMS)** |
| **Ready for Git Tag** | **`v1.12-beta`** |

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

```text
v1.11-beta ──(+ Sprint 17 Helpdesk)──► v1.12-beta ──► Sprint 18 DMS (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-15 | Initial ERP Core v1.12-beta release notes after Sprint 17 validation |

---

**Confirmations**

- `ERP_Core_v1.12-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.12-beta`**
- Ready to begin Sprint 18 planning

**ERP Core v1.12-beta release documentation completed and ready for release approval.**
