# ERP Core v1.11-beta - Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.11-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal - Confidential |
| **Predecessor** | [ERP Core v1.10-beta](./ERP_Core_v1.10-beta.md) |
| **Ready For** | Sprint 17 - Helpdesk |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.11-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-15 |
| **Previous Release** | ERP Core v1.10-beta |
| **Architecture Lock** | v1.1 - Preserved |
| **Recommended Git Tag** | `v1.11-beta` |

---

## 2. Sprint 16 Highlights

Sprint 16 delivered the **Service Management** domain (FRD-16 / ERD_16) as the service delivery and field-operations layer - request → ticket → assignment / schedule → work order → visit / resolution - while **existing masters remain authoritative (C-01)**. No duplicate customer / employee / asset / product / department masters. Billable expense posting occurs only through Finance `PostingService.post_system_journal()`, storing `finance_journal_id` UUID references only. Asset / CRM / Project / Inventory / Procurement / Manufacturing / Quality peer context uses UUID-only refs with **no peer ORM writes**.

| Capability | Delivery |
|------------|----------|
| **Service Module** | `apps/api/src/modules/service/` - Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Service Categories** | Domain catalog for service classification (not a master identity) |
| **Service Requests** | Customer intake with priority / SLA / submit / approve - FRD-16 §4 |
| **Service Tickets** | Triage / queue units linked to requests |
| **Service Assignments** | Technician dispatch to request / ticket / work order |
| **Service Schedules** | Planned technician time windows |
| **Work Orders** | Execution unit with submit / approve / complete - FRD-16 §6 |
| **Service Tasks** | Work-order task breakdown |
| **Service Checklists** | Pass/fail checklist capture on WO / visit / task |
| **Service Visits** | Field visit check-in / completion with optional geo metadata |
| **Service Materials** | Parts consumption via `master_product` |
| **Time Entries** | Billable / non-billable labor hours |
| **Service Expenses** | Cost capture with Finance PostingService post |
| **SLA** | Response / resolution policy definitions - FRD-16 §13 |
| **Escalations** | SLA / management escalations with workflow |
| **Feedback** | Customer rating / CSAT capture |
| **Resolution** | Closure / first-time-fix with completion workflow |
| **Documents** | Service document metadata (URI / hash) |
| **Notifications** | Service-scoped notification delivery ledger |
| **Service Contracts** | AMC / warranty / support / managed contracts with submit / approve - FRD-16 §5 |
| **Reports** | Volume / SLA / utilization / backlog snapshots |
| **Engines (20)** | ServiceCategory · ServiceRequest · ServiceTicket · ServiceAssignment · ServiceSchedule · ServiceWorkOrder · ServiceTask · ServiceChecklist · ServiceVisit · ServiceMaterial · ServiceTimeEntry · ServiceExpense · ServiceSla · ServiceEscalation · ServiceFeedback · ServiceResolution · ServiceDocument · ServiceNotification · ServiceContract · ServiceReport |

**Services:** `ServiceApplicationService`, `ServiceCategoryService`, `ServiceRequestService`, `ServiceTicketService`, `ServiceAssignmentService`, `ServiceScheduleService`, `WorkOrderService`, `ServiceTaskService`, `ServiceChecklistService`, `ServiceVisitService`, `ServiceMaterialService`, `ServiceTimeEntryService`, `ServiceExpenseService`, `ServiceSLAService`, `ServiceEscalationService`, `ServiceFeedbackService`, `ServiceResolutionService`, `ServiceDocumentService`, `ServiceNotificationService`, `ServiceContractService`, `ServiceReportService`, **`ServiceIntegrationService`**.

**Supporting delivered items:** document numbering (`SR` / `TKT` / `WO-SRV` / `SC` / related), Celery jobs (`sla_breach_monitor`, `work_order_reminders`, `preventive_service_scheduler`, `service_contract_expiry`, `customer_feedback_reminders`, `retry_finance_posting`), RBAC roles (`SERVICE_MANAGER`, `SERVICE_ENGINEER`, `SERVICE_COORDINATOR`, `SERVICE_ADMIN`), and workflows (`SVC_REQUEST_APPROVAL`, `SVC_WORK_ORDER_APPROVAL`, `SVC_COMPLETION_APPROVAL`, `SVC_SLA_ESCALATION`, `SVC_CONTRACT_APPROVAL`).

---

## 3. Service Management Module

| Item | Value |
|------|--------|
| **Schema** | `service` |
| **Prefix** | `svc_` |
| **Business Tables** | **20** |
| **ERD** | ERD_16 Service Management (locked) |
| **FRD** | FRD-16 Service Management |
| **API mount** | `/api/v1/service` |

**Tables:** `svc_service_category`, `svc_service_request`, `svc_service_ticket`, `svc_service_assignment`, `svc_service_schedule`, `svc_service_work_order`, `svc_service_task`, `svc_service_checklist`, `svc_service_visit`, `svc_service_material`, `svc_service_time_entry`, `svc_service_expense`, `svc_service_sla`, `svc_service_escalation`, `svc_service_feedback`, `svc_service_resolution`, `svc_service_document`, `svc_service_notification`, `svc_service_contract`, `svc_service_report`.

**Coverage:** categories · requests · tickets · assignments · schedules · work orders · tasks · checklists · visits · materials · time entries · expenses · SLA · escalations · feedback · resolution · documents · notifications · contracts · reports.

**API mount:** `/api/v1/service` - service-categories, service-requests (+ submit / approve), service-tickets, service-assignments, service-schedules, work-orders (+ submit / approve / complete), service-tasks, service-checklists, service-visits, service-materials, time-entries, service-expenses (+ submit / approve / post), service-slas, service-escalations (+ escalate), service-feedback, service-resolutions (+ submit / complete), service-documents, service-notifications, service-contracts (+ submit / approve), reports.

---

## 4. Cross Module Integrations

Service Management **never** duplicates customer, employee, asset, product, or department masters. **Existing masters remain authoritative (C-01)**. Peer domains are consumed via FKs, service adapters, or UUID-only references - **never** via direct ORM writes outside `svc_*`.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_customer` · `master_employee` · `master_asset` · `master_product` only (C-01)** - **no duplicate masters** |
| **Organization** | **`org_department` only** - no service department master |
| **Finance** | Store **`finance_journal_id` UUID only**; posting **only** through `PostingService.post_system_journal()` - **no direct `fin_*` writes** |
| **Asset** | Optional `asset_id` / `maintenance_plan_id` **UUID only** - **no `ast_*` FK / no writes** |
| **CRM** | Optional `crm_opportunity_id` / `crm_customer_id` **UUID only** - **no FK / no writes** |
| **Project** | Optional `project_id` **UUID only** - **no FK / no writes** |
| **Inventory** | Optional issue / receipt **UUID only** - **no FK / no writes** |
| **Procurement** | Optional PO **UUID only** - **no FK / no writes** |
| **Manufacturing** | Optional production order **UUID only** - **no FK / no writes** |
| **Quality** | Optional inspection **UUID only** - **no FK / no writes** |
| **HR** | Employee refs via Master Data - **read only / no `hr_*` writes** |
| **Payroll** | Optional labor cost **read** - **no `pay_*` writes** |
| **Recruitment** | **No writes** |
| **Foundation** | **Workflow** (`SVC_REQUEST_APPROVAL`, `SVC_WORK_ORDER_APPROVAL`, `SVC_COMPLETION_APPROVAL`, `SVC_SLA_ESCALATION`, `SVC_CONTRACT_APPROVAL`); **RBAC** (`service.*` permissions; roles `SERVICE_MANAGER`, `SERVICE_ENGINEER`, `SERVICE_COORDINATOR`, `SERVICE_ADMIN` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **984** |
| **OpenAPI Paths** | **653** |
| **Service Routes** | **96** |
| **Service OpenAPI Paths** | **56** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; Service Management APIs are visible under `/api/v1/service/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0288_seed_service_workflows` |
| **Migration range (this release delta)** | `0267_create_service_schema` → `0288_seed_service_workflows` |
| **Approximate business tables** | Approximately **268** (~248 at v1.10-beta + 20 Service) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `payroll`, `recruitment`, `project`, `asset`, **`service`** (**18**) |

```text
0267_create_service_schema
        ↓
0288_seed_service_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** - head `0288_seed_service_workflows` |
| **FastAPI Startup** | **PASS** - Application startup complete (validated on port **8020**; ports 8000 / 8010 unavailable) |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (1352 files)** |
| **Pytest** | **PASS (219)** |

Validation completed successfully. Head `0288_seed_service_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and Service routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| Integration test typing | Use `is not None` for service/engine import asserts in `tests/integration/service/test_service_module_import.py` (Sprint 16 MyPy `truthy-function` only) |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** - no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | Service domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/service` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed - Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 17 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.12-beta** (planned) |
| **Sprint** | **Sprint 17 - Helpdesk** |
| **Primary domain** | **Helpdesk & Customer Support** (FRD-17) |

**Planned scope (planning only - no implementation in this release):**

- Omnichannel helpdesk / case intake foundation
- Continuity with Master Data customer / employee masters (C-01)
- Optional bridge to Service tickets / requests via UUID / services only
- No redesign of Service · Asset · Project · Recruitment modules

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.11-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` · `v1.7-beta` · `v1.8-beta` · `v1.9-beta` · `v1.10-beta` unchanged |
| **Version** | **ERP Core v1.11-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · **Service** |
| **Alembic head** | **`0288_seed_service_workflows`** |
| **Tests** | **219 passed** |
| **Routes** | **984** FastAPI · **653** OpenAPI · **96** Service · **56** Service OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest - **ALL PASS** |
| **Next** | **Sprint 17 - Helpdesk** |
| **Ready for Git Tag** | **`v1.11-beta`** |

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

```text
v1.10-beta ──(+ Sprint 16 Service)──► v1.11-beta ──► Sprint 17 Helpdesk (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-15 | Initial ERP Core v1.11-beta release notes after Sprint 16 validation |

---

**Confirmations**

- `ERP_Core_v1.11-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.11-beta`**
- Ready to begin Sprint 17 planning

**ERP Core v1.11-beta release documentation completed and ready for release approval.**
