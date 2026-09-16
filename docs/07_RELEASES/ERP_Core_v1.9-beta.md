# ERP Core v1.9-beta - Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.9-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal - Confidential |
| **Predecessor** | [ERP Core v1.8-beta](./ERP_Core_v1.8-beta.md) |
| **Ready For** | Sprint 15 - Asset Management |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.9-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-14 |
| **Previous Release** | ERP Core v1.8-beta |
| **Architecture Lock** | v1.1 - Preserved |
| **Recommended Git Tag** | `v1.9-beta` |

---

## 2. Sprint 14 Highlights

Sprint 14 delivered the **Project Management** domain (FRD-11 / ERD_14) as the project lifecycle layer from initiation through closure - consuming existing Master Data and Organization masters only (C-01), without duplicating employee / customer / product / department masters, and posting project costs only through Finance `PostingService.post_system_journal()`.

| Capability | Delivery |
|------------|----------|
| **Project Module** | `apps/api/src/modules/project/` - Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Projects** | Project create / submit / approve / close with manager, customer, department, schedule |
| **Project Phases** | WBS phase catalog under a project |
| **Milestones** | Checkpoint tracking (planned / achieved / delayed) |
| **Tasks** | Work packages with priority, percent complete, gated submit / approve |
| **Task Dependencies** | Finish-to-start and related dependency graph |
| **Task Assignments** | Employee assignments to tasks |
| **Timesheets** | Period header with submit / approve |
| **Timesheet Entries** | Daily hours against project / task |
| **Resource Planning** | Resource plan headers for capacity windows |
| **Resource Allocation** | Employee / contractor allocations under plans |
| **Project Budgets** | Budget lines by type with submit / approve; `finance_budget_id` UUID |
| **Project Costs** | Actual costs with PostingService post; store `finance_journal_id` |
| **Issues** | Project / task issue register |
| **Risks** | Risk register with impact / probability / mitigation |
| **Change Requests** | Scope / schedule / budget change governance with workflow |
| **Documents** | Project document metadata (URI / hash) |
| **Comments** | Team collaboration comments |
| **Status History** | Project status transition ledger |
| **Notifications** | Project-scoped notification delivery ledger |
| **Reports** | Health / budget variance / profitability snapshots |
| **Engines (20)** | Project · ProjectPhase · ProjectMilestone · ProjectTask · TaskDependency · TaskAssignment · Timesheet · TimesheetEntry · ResourcePlan · ResourceAllocation · ProjectBudget · ProjectCost · ProjectIssue · ProjectRisk · ChangeRequest · ProjectDocument · ProjectComment · ProjectStatusHistory · ProjectNotification · ProjectReport |

**Services:** `ProjectApplicationService`, `ProjectService`, `PhaseService`, `MilestoneService`, `TaskService`, `TimesheetService`, `ResourcePlanningService`, `BudgetService`, `CostService`, `IssueService`, `RiskService`, `ChangeRequestService`, `DocumentService`, `CommentService`, `NotificationService`, `ProjectReportService`, **`ProjectIntegrationService`**.

**Supporting delivered items:** document numbering (`PRJ` / `TASK` / `TS` / `RPLAN` / `PBUD` / `PCOST` / `PISS` / `PRISK` / `PCR`), Celery jobs (`deadline_reminders`, `timesheet_reminders`, `budget_threshold_alerts`, `risk_review_notifications`, `project_health_refresh`, `retry_finance_posting`), RBAC roles (`PROJECT_MANAGER`, `PROJECT_COORDINATOR`, `PROJECT_MEMBER`, `PROJECT_ADMIN`), and workflows (`PRJ_PROJECT_APPROVAL`, `PRJ_TASK_APPROVAL`, `PRJ_BUDGET_APPROVAL`, `PRJ_CHANGE_REQUEST_APPROVAL`, `PRJ_PROJECT_CLOSURE`).

---

## 3. Project Management Module

| Item | Value |
|------|--------|
| **Schema** | `project` |
| **Prefix** | `prj_` |
| **Business Tables** | **20** |
| **ERD** | ERD_14 Project Management (locked) |
| **FRD** | FRD-11 Project Management |
| **API mount** | `/api/v1/projects` |

**Tables:** `prj_project`, `prj_project_phase`, `prj_project_milestone`, `prj_project_task`, `prj_task_dependency`, `prj_task_assignment`, `prj_timesheet`, `prj_timesheet_entry`, `prj_resource_plan`, `prj_resource_allocation`, `prj_project_budget`, `prj_project_cost`, `prj_project_issue`, `prj_project_risk`, `prj_change_request`, `prj_project_document`, `prj_project_comment`, `prj_project_status_history`, `prj_project_notification`, `prj_project_report`.

**Coverage:** projects · phases · milestones · tasks · dependencies · assignments · timesheets · resource planning · budgets · costs · issues · risks · change requests · documents · comments · status history · notifications · reports.

**API mount:** `/api/v1/projects` - projects (+ submit / approve / close), project-phases, project-milestones, project-tasks (+ submit / approve), task-dependencies, task-assignments, timesheets (+ submit / approve), timesheet-entries, resource-plans, resource-allocations, project-budgets (+ submit / approve), project-costs (+ post), project-issues, project-risks, change-requests (+ submit / approve), project-documents, project-comments, project-status-history, project-notifications, reports.

---

## 4. Cross Module Integrations

Project Management **never** duplicates employee, customer, product, or department masters. Existing masters remain authoritative (C-01). Peer domains are consumed via FKs, service adapters, or UUID-only references - **never** via direct ORM writes outside `prj_*`.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_employee` · `master_customer` · `master_product` only (C-01)** - no project-local masters |
| **Organization** | **`org_department` only** - no project department master |
| **Finance** | Budget / journal refs as **`finance_budget_id` / `finance_journal_id` UUID**; posting **only** through `PostingService.post_system_journal()` - **no direct `fin_*` writes** |
| **HR** | Employee refs via Master Data only - **no `hr_*` writes** |
| **Payroll** | Optional labor cost **read** - **no `pay_*` writes** |
| **CRM** | Optional `crm_opportunity_id` / `crm_customer_id` UUID - **no FK / no writes** |
| **Procurement** | Optional PR / PO UUID - **no FK / no writes** |
| **Inventory** | Optional material issue / receipt UUID - **no FK / no writes** |
| **Manufacturing** | Optional production order UUID - **no FK / no writes** |
| **Quality** | Optional inspection UUID - **no FK / no writes** |
| **Recruitment** | **No writes** |
| **Foundation** | **Workflow** (`PRJ_PROJECT_APPROVAL`, `PRJ_TASK_APPROVAL`, `PRJ_BUDGET_APPROVAL`, `PRJ_CHANGE_REQUEST_APPROVAL`, `PRJ_PROJECT_CLOSURE`); **RBAC** (`project.*` permissions; roles `PROJECT_MANAGER`, `PROJECT_COORDINATOR`, `PROJECT_MEMBER`, `PROJECT_ADMIN` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **790** |
| **OpenAPI Paths** | **539** |
| **Project Routes** | **92** |
| **Project OpenAPI Paths** | **52** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; Project Management APIs are visible under `/api/v1/projects/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0244_seed_project_workflows` |
| **Migration range (this release delta)** | `0223_create_project_schema` → `0244_seed_project_workflows` |
| **Approximate business tables** | Approximately **228** (~208 at v1.8-beta + 20 Project) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `payroll`, `recruitment`, **`project`** (**16**) |

```text
0223_create_project_schema
        ↓
0244_seed_project_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** - head `0244_seed_project_workflows` |
| **FastAPI Startup** | **PASS** - Application startup complete |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (1127 files)** |
| **Pytest** | **PASS (199)** |

Validation completed successfully. Head `0244_seed_project_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and Project routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| Router path templates | Leading `/` before `{row_id}` (and action suffixes) in `modules/project/routers/__init__.py` to match prior-module path conventions |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** - no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | Project domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/project` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed - Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 15 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.10-beta** (planned) |
| **Sprint** | **Sprint 15 - Asset Management** |
| **Primary domain** | **Asset Management** |

**Planned scope (planning only - no implementation in this release):**

- Asset register and lifecycle (acquire → deploy → maintain → retire)
- Depreciation readiness via Finance services only
- Continuity with Master Data asset / employee / warehouse masters (C-01)
- No redesign of Project · Recruitment · Payroll · HR modules

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.9-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` · `v1.7-beta` · `v1.8-beta` unchanged |
| **Version** | **ERP Core v1.9-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · **Project** |
| **Alembic head** | **`0244_seed_project_workflows`** |
| **Tests** | **199 passed** |
| **Routes** | **790** FastAPI · **539** OpenAPI · **92** Project · **52** Project OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest - **ALL PASS** |
| **Next** | **Sprint 15 - Asset Management** |
| **Ready for Git Tag** | **`v1.9-beta`** |

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

```text
v1.8-beta ──(+ Sprint 14 Project)──► v1.9-beta ──► Sprint 15 Asset Management (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-14 | Initial ERP Core v1.9-beta release notes after Sprint 14 validation |

---

**Confirmations**

- `ERP_Core_v1.9-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.9-beta`**
- Ready to begin Sprint 15 planning

**ERP Core v1.9-beta release documentation completed and ready for release approval.**
