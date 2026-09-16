# ERP Core v1.10-beta - Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.10-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal - Confidential |
| **Predecessor** | [ERP Core v1.9-beta](./ERP_Core_v1.9-beta.md) |
| **Ready For** | Sprint 16 - Service Management |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.10-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-14 |
| **Previous Release** | ERP Core v1.9-beta |
| **Architecture Lock** | v1.1 - Preserved |
| **Recommended Git Tag** | `v1.10-beta` |

---

## 2. Sprint 15 Highlights

Sprint 15 delivered the **Asset Management** domain (FRD-12 / ERD_15) as the operational asset lifecycle register - acquire → deploy → maintain → depreciate → dispose - while **`master.master_asset` remains the authoritative identity (C-01)**. No duplicate asset / employee / product / vendor / department masters. Depreciation, disposal, and revaluation post only through Finance `PostingService.post_system_journal()`, storing `finance_journal_id` / `depreciation_batch_id` UUID references only.

| Capability | Delivery |
|------------|----------|
| **Asset Module** | `apps/api/src/modules/asset/` - Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Asset Categories** | Domain catalog for asset classification (not a master identity) |
| **Assets** | Operational lifecycle register with `master_asset_id` FK; create / submit / approve |
| **Components** | Child / spare component hierarchy under an asset |
| **Assignments** | Employee / location custody with submit / approve / return |
| **Transfers** | Inter-location / branch transfers with complete |
| **Locations** | Physical / custodial location ledger for assets |
| **Warranties** | Warranty coverage windows and expiry tracking |
| **Insurance** | Insurance policies and premium / expiry tracking |
| **Maintenance Plans** | Preventive / planned maintenance schedule definitions |
| **Maintenance** | Work orders with submit / approve / complete |
| **Service History** | Completed service event ledger |
| **Depreciation** | Period depreciation calculate / post via Finance PostingService |
| **Disposal** | Sale / scrap / donation / write-off with workflow + finance post |
| **Revaluation** | Book-value revaluation with workflow + finance post |
| **Asset Audit** | Physical verification / count complete flow |
| **Documents** | Asset document metadata (URI / hash) |
| **Checklists** | Inspection / maintenance checklist templates and results |
| **Meter Readings** | Usage / odometer / runtime meter capture |
| **Notifications** | Asset-scoped notification delivery ledger |
| **Reports** | Register / depreciation / maintenance snapshot reports |
| **Engines (20)** | AssetCategory · Asset · AssetComponent · AssetAssignment · AssetTransfer · AssetLocation · AssetWarranty · AssetInsurance · AssetMaintenancePlan · AssetMaintenance · AssetServiceHistory · AssetDepreciation · AssetDisposal · AssetRevaluation · AssetAudit · AssetDocument · AssetChecklist · AssetMeterReading · AssetNotification · AssetReport |

**Services:** `AssetApplicationService`, `AssetService`, `AssetCategoryService`, `ComponentService`, `AssignmentService`, `TransferService`, `LocationService`, `WarrantyService`, `InsuranceService`, `MaintenancePlanService`, `MaintenanceService`, `ServiceHistoryService`, `DepreciationService`, `DisposalService`, `RevaluationService`, `AssetAuditService`, `DocumentService`, `ChecklistService`, `MeterReadingService`, `NotificationService`, `AssetReportService`, **`AssetIntegrationService`**.

**Supporting delivered items:** document numbering for operational registers, Celery jobs (`maintenance_due_alerts`, `warranty_expiry_alerts`, `insurance_expiry_alerts`, `depreciation_scheduler`, `asset_audit_reminders`, `retry_finance_posting`), RBAC roles (`ASSET_MANAGER`, `ASSET_EXECUTIVE`, `ASSET_AUDITOR`, `ASSET_ADMIN`), and workflows (`AST_ASSET_APPROVAL`, `AST_ASSIGNMENT_APPROVAL`, `AST_MAINTENANCE_APPROVAL`, `AST_DISPOSAL_APPROVAL`, `AST_REVALUATION_APPROVAL`).

---

## 3. Asset Management Module

| Item | Value |
|------|--------|
| **Schema** | `asset` |
| **Prefix** | `ast_` |
| **Business Tables** | **20** |
| **ERD** | ERD_15 Asset Management (locked) |
| **FRD** | FRD-12 Asset Management |
| **API mount** | `/api/v1/assets` |

**Tables:** `ast_asset_category`, `ast_asset`, `ast_asset_component`, `ast_asset_assignment`, `ast_asset_transfer`, `ast_asset_location`, `ast_asset_warranty`, `ast_asset_insurance`, `ast_asset_maintenance_plan`, `ast_asset_maintenance`, `ast_asset_service_history`, `ast_asset_depreciation`, `ast_asset_disposal`, `ast_asset_revaluation`, `ast_asset_audit`, `ast_asset_document`, `ast_asset_checklist`, `ast_asset_meter_reading`, `ast_asset_notification`, `ast_asset_report`.

**Coverage:** categories · assets · components · assignments · transfers · locations · warranties · insurance · maintenance plans · maintenance · service history · depreciation · disposal · revaluation · audits · documents · checklists · meter readings · notifications · reports.

**API mount:** `/api/v1/assets` - asset-categories, assets (+ submit / approve), asset-components, asset-assignments (+ submit / approve / return), asset-transfers (+ complete), asset-locations, asset-warranties, asset-insurances, maintenance-plans, asset-maintenances (+ submit / approve / complete), service-histories, asset-depreciations (+ calculate / post), asset-disposals (+ submit / approve / post), asset-revaluations (+ submit / approve / post), asset-audits (+ complete), asset-documents, asset-checklists, meter-readings, asset-notifications, reports.

---

## 4. Cross Module Integrations

Asset Management **never** duplicates asset, employee, product, vendor, or department masters. **`master_asset` remains authoritative (C-01)**; `ast_asset` is the operational lifecycle register with required `master_asset_id` when approved / active. Peer domains are consumed via FKs, service adapters, or UUID-only references - **never** via direct ORM writes outside `ast_*`.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_asset` (identity, C-01)** · `master_employee` · `master_product` · `master_vendor` - create / link master_asset on approve via Master Data services; **no duplicate masters** |
| **Organization** | **`org_department` only** - no asset department master |
| **Finance** | Store **`finance_journal_id` / `depreciation_batch_id` UUID only**; posting **only** through `PostingService.post_system_journal()` - **no direct `fin_*` writes** |
| **Procurement** | Optional PO / GRN **UUID only** - **no FK / no writes** |
| **Inventory** | Optional receipt / issue **UUID only** - **no FK / no writes** |
| **Project** | Optional project **UUID only** - **no FK / no writes** |
| **Manufacturing** | Optional production order **UUID only** - **no FK / no writes** |
| **Quality** | Optional inspection **UUID only** - **no FK / no writes** |
| **HR** | Employee refs via Master Data - **read only / no `hr_*` writes** |
| **Payroll** | Optional cost context - **read only / no `pay_*` writes** |
| **CRM** | **No writes** |
| **Recruitment** | **No writes** |
| **Foundation** | **Workflow** (`AST_ASSET_APPROVAL`, `AST_ASSIGNMENT_APPROVAL`, `AST_MAINTENANCE_APPROVAL`, `AST_DISPOSAL_APPROVAL`, `AST_REVALUATION_APPROVAL`); **RBAC** (`asset.*` permissions; roles `ASSET_MANAGER`, `ASSET_EXECUTIVE`, `ASSET_AUDITOR`, `ASSET_ADMIN` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **888** |
| **OpenAPI Paths** | **597** |
| **Asset Routes** | **98** |
| **Asset OpenAPI Paths** | **58** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; Asset Management APIs are visible under `/api/v1/assets/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0266_seed_asset_workflows` |
| **Migration range (this release delta)** | `0245_create_asset_schema` → `0266_seed_asset_workflows` |
| **Approximate business tables** | Approximately **248** (~228 at v1.9-beta + 20 Asset) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `payroll`, `recruitment`, `project`, **`asset`** (**17**) |

```text
0245_create_asset_schema
        ↓
0266_seed_asset_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** - head `0266_seed_asset_workflows` |
| **FastAPI Startup** | **PASS** - Application startup complete |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (1239 files)** |
| **Pytest** | **PASS (209)** |

Validation completed successfully. Head `0266_seed_asset_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and Asset routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| Finance adapter typing | Resolve optional `branch_id` via `ctx.branch_id` before `JournalService.create_journal` in `modules/asset/adapters/finance_port.py` (Sprint 15 MyPy `arg-type` only) |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** - no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | Asset domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/asset` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed - Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 16 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.11-beta** (planned) |
| **Sprint** | **Sprint 16 - Service Management** |
| **Primary domain** | **Service Management** (FRD-16) |

**Planned scope (planning only - no implementation in this release):**

- Service request / work-order / SLA foundation
- Continuity with Master Data customer / asset / employee masters (C-01)
- Optional cross-links to Project · Asset · CRM via UUID / services only
- No redesign of Asset · Project · Recruitment · Payroll · HR modules

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.10-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` · `v1.7-beta` · `v1.8-beta` · `v1.9-beta` unchanged |
| **Version** | **ERP Core v1.10-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · **Asset** |
| **Alembic head** | **`0266_seed_asset_workflows`** |
| **Tests** | **209 passed** |
| **Routes** | **888** FastAPI · **597** OpenAPI · **98** Asset · **58** Asset OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest - **ALL PASS** |
| **Next** | **Sprint 16 - Service Management** |
| **Ready for Git Tag** | **`v1.10-beta`** |

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

```text
v1.9-beta ──(+ Sprint 15 Asset)──► v1.10-beta ──► Sprint 16 Service Management (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-14 | Initial ERP Core v1.10-beta release notes after Sprint 15 validation |

---

**Confirmations**

- `ERP_Core_v1.10-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.10-beta`**
- Ready to begin Sprint 16 planning

**ERP Core v1.10-beta release documentation completed and ready for release approval.**
