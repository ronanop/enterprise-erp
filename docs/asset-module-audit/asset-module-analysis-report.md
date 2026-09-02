# Asset Management Module — Analysis Report

**Generated:** 2026-08-25  
**Mode:** Static code analysis (read-only). Live API/UI was not executed in this pass.  
**Scope:** Asset Management module only. Shared files consumed by this module are listed under Uncertain / shared files.

**Folder paths**

| Layer | Path |
|---|---|
| Backend package | `apps/api/src/modules/asset/` |
| Backend tests | `apps/api/src/tests/{unit,integration,security}/asset/` |
| Alembic (asset schema) | `apps/api/alembic/versions/*ast_*` |
| Frontend App Router pages | `apps/web/src/app/(app)/assets/` |
| Frontend components | `apps/web/src/components/assets/` |
| Frontend API client | `apps/web/src/services/assets-service.ts`, `apps/web/src/services/assignment-frontend-service.ts` |
| Frontend config | `apps/web/src/config/assets.ts`, `asset-prd-types.ts`, `asset-it-config-rules.ts`, `asset-site-catalog.ts` |

---

## 0. Discoverability / module file inventory

### Tech stack actually used (verified from imports / package manifests)

| Layer | Stack (verified) |
|---|---|
| Backend | FastAPI (`apps/api/pyproject.toml`), SQLAlchemy 2.0 mapped columns, Alembic, Pydantic v2 schemas (`modules/asset/schemas.py`), Celery (`modules/asset/tasks.py`), PostgreSQL schema `asset` |
| Frontend | Next.js 16.2.10 App Router, React 19, TypeScript, Tailwind CSS 4, ShadCN/Radix (`@/components/ui/*`), Lucide icons, Zod (app dependency; **not used** in asset forms), react-hook-form (app dependency; **not used** in asset forms), `qrcode.react`, `xlsx`, `jspdf` / `jspdf-autotable`, `recharts` (reports) |
| State | React `useState` / `useEffect` / `useCallback` local state. No Redux, Zustand, React Query, or SWR in this module. Inventory UI snapshot persisted via `inventory-ui-state.ts` (session/local helper). |
| Auth | FastAPI `Depends(require_permission("asset.*"))` + tenant context. Frontend `isAuthenticated()` + `useUserPermissions` for inventory action gates. |

### Backend files considered in-scope

**Package root:** `apps/api/src/modules/asset/` (~163 Python files)

| Area | Paths |
|---|---|
| Router aggregation | `router.py` |
| HTTP handlers | `routers/__init__.py` (~3021 lines, all asset HTTP routes) |
| Permissions | `permissions.py` |
| Pydantic DTOs | `schemas.py` |
| Domain | `domain/enums.py`, `domain/entities.py`, `domain/exceptions.py`, `domain/value_objects.py`, `domain/workflow_codes.py`, `domain/operational_status_rules.py`, `domain/operational_status_audit_events.py`, `domain/operational_status_backfill.py`, `domain/assignment_return_condition.py`, `domain/excel_import.py`, plus assignment enrichment helpers |
| ORM | `models/*.py` (25 files) |
| Repositories | `repository/*.py` |
| Services | `service/*_service.py`, `service/*_validator.py`, `service/engines/*.py` |
| Adapters | `adapters/{finance,master_data,organization,payroll,procurement_read}_port.py` |
| Celery | `tasks.py` |
| DI helpers | `dependencies.py` |

**Tests:** `apps/api/src/tests/unit/asset/` (~100 files), `apps/api/src/tests/integration/asset/`, `apps/api/src/tests/security/asset/`

**Migrations (asset schema / governance):** Alembic revisions `0246`–`0264` (core tables) and `0465`–`0494` (document sequence, governance, incoming, operational status, assignment components). Filename prefix `*_ast_*`.

### Frontend files considered in-scope

| Area | Paths |
|---|---|
| Routes | `apps/web/src/app/(app)/assets/layout.tsx`, `page.tsx`, `[resource]/page.tsx`, `assets/new/page.tsx`, `assets/[assetId]/page.tsx`, `asset-assignments/new/page.tsx`, `asset-assignments/return/page.tsx`, `information-portal/[assetId]/page.tsx`, `self-service/[assetId]/page.tsx`, `inventory-import/page.tsx` |
| Module sidebar / nav | `components/assets/assets-module-sidebar.tsx`, `config/assets.ts`, `components/assets/navigation/*` |
| Dashboard | `asset-operations-container.tsx`, `asset-operations-dashboard.tsx`, `asset-operations-fetch.ts`, `dashboard.mapper.ts`, `assets-pipeline-funnel.tsx`, `assets-dashboard.tsx` |
| Inventory | `asset-inventory-container.tsx`, `asset-inventory-workspace.tsx`, `inventory/**`, `inventory.mapper.ts`, `inventory.types.ts` |
| Wizards | `assignment-wizard/**` |
| Excel import | `excel-import/**` |
| Workspaces | `asset-*-workspace.tsx` (categories, assignments, transfers, maintenance, disposal, depreciation, revaluation, audit, warranty, insurance, components, documents, locations, maintenance plans, service history, checklists, meters, notifications, reports, QR, types, settings, incoming, QC, registration queue) |
| Forms / dialogs | `asset-add-form.tsx`, `asset-detail-workspace.tsx`, `asset-discovery-panel.tsx`, `start-disposal-confirm-dialog.tsx`, `reinstate-confirm-dialog.tsx` |
| Shared UI | `components/assets/shared/**` |
| Services | `services/assets-service.ts`, `services/assignment-frontend-service.ts` |
| Domain helpers | `domain/asset-prd.ts` |
| Config catalogs | `config/asset-prd-types.ts`, `config/asset-it-config-rules.ts`, `config/asset-site-catalog.ts` |

### Uncertain / shared files (consumed by Asset, owned elsewhere)

| File / package | Why uncertain |
|---|---|
| `apps/web/src/config/modules.ts` (`key: "assets"` block ~1161–1350) | Global module registry; also contains Master Data `md-assets` |
| `apps/web/src/components/layout/app-shell.tsx`, `app-sidebar.tsx`, `app-topbar.tsx` | App chrome wrapping Asset pages |
| `apps/web/src/components/module/resource-list-view.tsx` | Used by `AssetOrgMasterWrapper` for departments |
| `apps/web/src/services/api-client.ts` | Shared HTTP client |
| `apps/web/src/lib/org-options.ts`, `lib/auth.ts` | Branch / employee / department / location lookups |
| `apps/web/src/hooks/use-user-permissions.ts`, `use-standalone-chrome.ts` | Shared hooks |
| `apps/web/src/components/ui/*` | ShadCN design-system primitives |
| `apps/api/src/modules/master_data/` (`assets_router` on `master.master_asset`) | Separate master-data asset catalog; Asset module links `AstAsset.master_asset_id` on approve |
| `apps/api/src/modules/foundation/` | Workflow, Audit, Notification engines used by `governance_service.py` |
| `apps/api/src/modules/finance/` | Journal posting via `adapters/finance_port.py` |
| `apps/api/src/modules/organization/` | Departments, branches; Configuration → Departments UI wraps org API `/departments` |
| Procurement GRN / PO | Incoming assets sync from GRN via `adapters/procurement_read_port.py` |
| `docs/06_ERD/ERD_15_Asset_Management.md`, `docs/02_FRD/FRD-12-Asset-Management-Domain.md` | Spec, not runtime |
| `.cursor/skills/brand/` “asset” scripts | Brand-skill naming collision; not this ERP module |

---

## 1. Module Overview

Asset Management is an operations-domain ERP module (`modules.ts` group `"operations"`) that owns the physical/IT asset lifecycle after procurement receipt.

**What it does (as implemented):**

1. **Register** assets (`ast_asset`) with dual status: lifecycle `status` (draft → active / disposed / …) and orthogonal IT `operational_status` (READY_TO_MOVE / ASSIGNED / RETIRED / PENDING_DISPOSAL / DISPOSED).
2. **Receive** GRN-sourced incoming lines, mark arrival, run QC, then register QC-accepted units.
3. **Assign / return** custody to employee (and other allocation types), including accessory components and delivery-challan metadata.
4. **Transfer** between branches/departments/locations.
5. **Maintain** via work orders and maintenance plans; record service history, checklists, meter readings.
6. **Depreciate / revalue / dispose** with optional Finance journal posting.
7. **Comply** via physical audits, warranties, insurance, documents, notifications, reports.
8. **Identify** via QR that encodes a self-service URL; IT discovery parse/apply for hardware profiles.

**Place in the ERP:** After Organization + Master Data + Foundation (workflow/audit/notification) + Procurement (GRN). Downstream to Finance (depreciation/disposal/revaluation post). HR/payroll is touched only via employee master FKs / payroll adapter.

**Sub-features that exist in code**

| Sub-feature | Backend | Frontend (sidebar) | Frontend (routed, not in locked sidebar) |
|---|---|---|---|
| Dashboard / KPIs | `GET /assets/assets/dashboard-summary` | Yes | — |
| Asset register / inventory | CRUD + workflow | All Assets | Detail `/assets/assets/[id]` |
| Incoming receiving | Incoming + arrive | Incoming Assets | — |
| Incoming QC | QC start/accept/reject | Incoming QC | — |
| Pending registration | Registration queue + Excel template | Pending Registration | — |
| Add / register asset | POST + submit/approve | Add Asset | Prefill from incoming query params |
| Categories | CRUD + deactivate/reactivate | Categories | — |
| Asset types | Enum on `ast_asset.asset_type` | Asset Types (UI catalog only) | — |
| Locations (config) | — | Locations (placeholder) | — |
| Departments | Org master | Departments (org wrapper) | — |
| Assignment + return | Full workflow + components | Asset Assignment | Issue wizard, Return wizard |
| Transfer | Full workflow | Transfers | — |
| Maintenance WO | Full workflow | Maintenance | — |
| Disposal | Full workflow + post | Disposal | Start-disposal / reinstate from inventory & detail |
| Components | Install / replace / dispose / tree | Components | — |
| Documents | CRUD + supersede/archive | Documents | — |
| QR / barcode | `qr_code` field on asset | QR / Barcode | Self-service + information portal |
| Reports | Catalog / run / export / snapshots | Reports | — |
| Excel bulk import | `POST /assets/assets/import` | **Not in sidebar** | `/assets/inventory-import` |
| Depreciation | Generate / calculate / post / reverse | No | `/assets/asset-depreciations` |
| Revaluation | Workflow + post | No | `/assets/asset-revaluations` |
| Audits | Plan / start / complete | No | `/assets/asset-audits` |
| Warranties | Activate / extend / expire | No | `/assets/asset-warranties` |
| Insurance | Activate / renew / expire / close | No | `/assets/asset-insurances` |
| Maintenance plans | Activate / pause / resume / close | No | `/assets/maintenance-plans` |
| Service history | Create / list | No | `/assets/service-histories` |
| Checklists | Complete / cancel | No | `/assets/asset-checklists` |
| Meter readings | Create / void | No | `/assets/meter-readings` |
| Notifications (asset table) | Mark read/sent/failed / archive | No | `/assets/asset-notifications` |
| Asset location history | Create / complete (current vs historical) | No | `/assets/asset-locations` |
| Settings | — | No | `/assets/settings` (copy-only) |
| IT discovery | Command / parse / apply | — | Embedded on asset detail for IT categories |
| Information portal / self-service | GET portal payloads | — | Dedicated routes |

Locked sidebar comment in `config/assets.ts`: *“Visible sidebar (`assetManagementNav`) is the CURRENT implemented scope only.”* Dashboard workspace groups (`assetsWorkspaceGroups`) still advertise Lifecycle (depreciation/revaluation) and Compliance (audits/warranties/insurance) that are routed but hidden from the rail.

---

## 2. Backend Analysis

### 2.1 Folder / file structure

```
apps/api/src/modules/asset/
  router.py                 # APIRouter prefix=/assets, includes all sub-routers
  routers/__init__.py       # all HTTP handlers
  permissions.py            # 90 permission tuples
  schemas.py                # Pydantic v2 DTOs
  dependencies.py           # db, pagination, require_permission
  tasks.py                  # Celery
  domain/                   # enums, exceptions, pure rules
  models/                   # SQLAlchemy 2.0, schema=asset, tables ast_*
  repository/               # persistence
  service/                  # application services + validators + engines/
  adapters/                 # outbound ports (finance, org, master, procurement, payroll)
```

Mandatory flow is preserved: Router → Service → Repository → Database. Engines hold state-machine transitions. Validators hold business rules. `AssetGovernanceService` delegates to Foundation Workflow / Audit / Notification.

Mounted at FastAPI `API_V1_PREFIX` = `/api/v1` via `apps/api/src/shared/router.py`.

Effective prefix: **`/api/v1/assets/...`**.

### 2.2 API endpoints

All handlers use `Depends(require_permission(...))`. There are **no HTTP DELETE** handlers on business aggregates (soft-cancel / archive / void instead).

Auth column = permission code passed to `require_permission`.

#### Asset categories — prefix `/asset-categories`

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/` | List/search categories | `asset.category:read` |
| GET | `/{row_id}` | Get one | `asset.category:read` |
| POST | `/` | Create | `asset.category:create` |
| PATCH | `/{row_id}` | Update | `asset.category:update` |
| POST | `/{row_id}/deactivate` | Set inactive | `asset.category:update` |
| POST | `/{row_id}/reactivate` | Set active | `asset.category:update` |

#### Asset register — prefix `/assets`

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/` | Paginated inventory search (q, ops status, type, dept, location, employee, assignment_state, make, model) | `asset.asset:read` |
| GET | `/dashboard-summary` | KPI counts | `asset.asset:read` |
| POST | `/import` | Excel/CSV row import orchestration | `asset.asset:create` |
| GET | `/registration/prefill` | Prefill from GRN | `asset.asset:create` |
| GET | `/registration/prefill-from-incoming` | Prefill from incoming unit | `asset.asset:create` |
| GET | `/{row_id}` | Get asset | `asset.asset:read` |
| GET | `/{row_id}/information-portal` | Redacted portal payload | `asset.asset:read` |
| GET | `/{row_id}/self-service` | Same redaction as portal | `asset.asset:read` |
| GET | `/discovery/command` | OS discovery command text | `asset.asset:read` |
| POST | `/{row_id}/discovery/parse` | Parse discovery output | `asset.asset:read` |
| POST | `/{row_id}/discovery/apply` | Apply discovery to asset | `asset.asset:update` |
| POST | `/` | Create (draft) | `asset.asset:create` |
| PATCH | `/{row_id}` | Update | `asset.asset:update` |
| POST | `/{row_id}/submit` | Workflow submit | `asset.asset:submit` |
| POST | `/{row_id}/approve` | Workflow approve | `asset.asset:approve` |
| POST | `/{row_id}/reject` | Workflow reject | `asset.asset:approve` |
| POST | `/{row_id}/cancel` | Cancel draft | `asset.asset:update` |
| POST | `/{row_id}/reopen` | Reopen | `asset.asset:update` |
| POST | `/{row_id}/resubmit` | Resubmit | `asset.asset:submit` |
| POST | `/{row_id}/start-disposal` | RETIRED → PENDING_DISPOSAL | `asset.disposal:create` |
| POST | `/{row_id}/reinstate` | PENDING_DISPOSAL → READY_TO_MOVE | `asset.disposal:create` |

#### Components — prefix `/asset-components`

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/` | List | `asset.component:read` |
| GET | `/tree` | Tree for an asset | `asset.component:read` |
| GET | `/{row_id}` | Get | `asset.component:read` |
| GET | `/{row_id}/history` | History | `asset.component:read` |
| POST | `/` | Install | `asset.component:create` |
| PATCH | `/{row_id}` | Update | `asset.component:update` |
| POST | `/{row_id}/replace` | Replace | `asset.component:update` |
| POST | `/{row_id}/dispose` | Dispose component | `asset.component:update` |

#### Assignments — prefix `/asset-assignments`

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/` | List | `asset.assignment:read` |
| GET | `/{row_id}` | Get (`include_components` query) | `asset.assignment:read` |
| GET | `/{row_id}/components` | Issued component lines | `asset.assignment:read` |
| POST | `/{row_id}/components` | Set component_ids | `asset.assignment:update` |
| POST | `/` | Create draft | `asset.assignment:create` |
| PATCH | `/{row_id}` | Update draft | `asset.assignment:update` |
| POST | `/{row_id}/submit` | Submit | `asset.assignment:submit` |
| POST | `/{row_id}/approve` | Approve | `asset.assignment:approve` |
| POST | `/{row_id}/reject` | Reject | `asset.assignment:approve` |
| POST | `/{row_id}/cancel` | Cancel draft | `asset.assignment:create` |
| POST | `/{row_id}/reopen` | Reopen | `asset.assignment:create` |
| POST | `/{row_id}/resubmit` | Resubmit | `asset.assignment:submit` |
| POST | `/{row_id}/return` | Return with condition + component outcomes | `asset.assignment:return` |

#### Transfers — prefix `/asset-transfers`

GET list/get, POST create, PATCH update, POST `{submit,approve,reject,cancel,reopen,resubmit}`. Permissions: `asset.transfer:read|create|update|submit|approve`.

#### Locations (per-asset history) — prefix `/asset-locations`

GET list/get, POST create, PATCH update, POST `{row_id}/complete`. Permissions: `asset.location:read|create|complete` (update uses create/complete family).

#### Warranties — prefix `/asset-warranties`

CRUD + POST `{activate,extend,expire}`. Permissions `asset.warranty:*`.

#### Insurance — prefix `/asset-insurances`

CRUD + POST `{activate,renew,expire,close}`. Permissions `asset.insurance:*`.

#### Maintenance plans — prefix `/maintenance-plans`

CRUD + POST `{activate,pause,resume,close}`. Permissions `asset.maintenance_plan:*`.

#### Maintenance work orders — prefix `/asset-maintenances`

CRUD + POST `{submit,approve,reject,cancel,reopen,resubmit,schedule,start,complete}`. Permissions `asset.maintenance:*`.

#### Service history — prefix `/service-histories`

GET list/get, POST create. Auth: `asset.maintenance:read|create`. **No update/void.**

#### Depreciation — prefix `/asset-depreciations`

GET list/get, POST create, POST `/generate-run`, PATCH update, POST `{calculate,post,reverse}`. Permissions `asset.depreciation:read|update|calculate|post`.

#### Disposal — prefix `/asset-disposals`

GET list/get, POST create, PATCH update, POST `{submit,approve,reject,cancel,reopen,resubmit,post}`. Permissions `asset.disposal:*`.

#### Revaluation — prefix `/asset-revaluations`

Same workflow pattern as disposal + `post`. Permissions `asset.revaluation:*`.

#### Audits — prefix `/asset-audits`

CRUD + POST `{start,complete,cancel}`. Permissions `asset.audit:*`.

#### Documents — prefix `/asset-documents`

CRUD + POST `{supersede,archive}`. Permissions `asset.document:*`.

#### Checklists — prefix `/asset-checklists`

CRUD + POST `{complete,cancel}`. Permissions `asset.checklist:*`.

#### Meter readings — prefix `/meter-readings`

GET list/get, POST create, POST `{row_id}/void`. **No PATCH.** Permissions `asset.meter:read|create|update`.

#### Notifications (asset-owned rows) — prefix `/asset-notifications`

CRUD + POST `{archive,mark-read,mark-sent,mark-failed}`. Permissions `asset.notification:*`.

#### Reports — prefix `/reports`

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/catalog` | Live report keys | `asset.report:read` |
| GET | `/dashboard` | Report dashboard aggregates | `asset.report:read` |
| GET | `/run/{report_key}` | Run live report | `asset.report:read` |
| GET | `/export/{report_key}` | Export payload | `asset.report:export` |
| POST | `/generate` | Persist snapshot | `asset.report:export` |
| GET | `/` | List snapshots | `asset.report:read` |
| GET | `/{row_id}` | Get snapshot | `asset.report:read` |
| POST | `/` | Create/generate snapshot | `asset.report:export` |
| PATCH | `/{row_id}` | Update snapshot | `asset.report:export` |
| POST | `/{row_id}/finalize` | Finalize snapshot | `asset.report:export` |

Live `report_key` values (`AssetLiveReportKey`): `asset_summary`, `asset_inventory`, `asset_allocation`, `asset_transfers`, `asset_maintenance`, `maintenance_due`, `warranty_expiry`, `insurance_expiry`, `asset_depreciation`, `asset_disposal`, `asset_documents`, `asset_checklists`, `asset_meter_readings`, `asset_notifications`, `executive_dashboard`.

#### Incoming assets — prefix `/incoming-assets`

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/summary` | Counts | `asset.incoming:read` |
| GET | `/qc` | QC worklist | `asset.incoming_qc:read` |
| GET | `/` | Incoming lines | `asset.incoming:read` |
| GET | `/{row_id}/qc` | QC line | `asset.incoming_qc:read` |
| POST | `/{row_id}/qc/start` | Start QC | `asset.incoming_qc:inspect` |
| POST | `/{row_id}/qc/accept` | Accept qty/units | `asset.incoming_qc:inspect` |
| POST | `/{row_id}/qc/reject` | Reject | `asset.incoming_qc:inspect` |
| GET | `/{row_id}` | Incoming line | `asset.incoming:read` |
| POST | `/{row_id}/arrive` | Mark arrival | `asset.incoming:receive` |

#### Registration queue — prefix `/registration-queue`

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/summary` | Queue counts | `asset.incoming_qc:read` |
| GET | `/` | Eligible units | `asset.incoming_qc:read` |
| GET | `/excel-template` | CSV template download | `asset.asset:create` |
| POST | `/excel/validate` | Validate registration rows | `asset.asset:create` |
| POST | `/excel/confirm` | Bulk-register from Excel | `asset.asset:create` |

### 2.3 Data models / schemas / relationships

PostgreSQL schema: **`asset`**. Table prefix: **`ast_`**. Mixins: tenant, company, (branch on transactions), audit columns, version, soft delete (`AstTransactionMixin` / `AstMasterMixin` / `AstDetailMixin` in `models/mixins.py`).

| Entity | Table | Key FKs / notes |
|---|---|---|
| `AstAssetCategory` | `ast_asset_category` | Optional `branch_id` → org branch; GL account UUID fields (no FK) |
| `AstAsset` | `ast_asset` | `asset_category_id`; optional `master_asset_id`, `product_id`, `supplier_vendor_id`, `department_id`, `custodian_employee_id`; optional procurement/project/quality UUIDs without FK; `discovery_profile_json` JSONB |
| `AstAssetComponent` | `ast_asset_component` | `asset_id`; optional `product_id`; `component_type` enum |
| `AstAssignmentComponent` | `ast_assignment_component` | `assignment_id`, `component_id`; `issue_status`; partial unique on active ISSUED |
| `AstAssetAssignment` | `ast_asset_assignment` | `asset_id`; optional employee/department; `project_id` UUID no FK; delivery challan fields; `workflow_instance_id` → foundation |
| `AstAssetTransfer` | `ast_asset_transfer` | `asset_id`; from/to branch (org FK), dept, employee, location labels |
| `AstAssetLocation` | `ast_asset_location` | `asset_id`; `location_label`; optional `org_location_id`; `is_current` |
| `AstAssetWarranty` | `ast_asset_warranty` | `asset_id` |
| `AstAssetInsurance` | `ast_asset_insurance` | `asset_id` |
| `AstAssetMaintenancePlan` | `ast_asset_maintenance_plan` | `asset_id` |
| `AstAssetMaintenance` | `ast_asset_maintenance` | `asset_id`; optional plan |
| `AstAssetServiceHistory` | `ast_asset_service_history` | `asset_id`, `maintenance_id` |
| `AstAssetDepreciation` | `ast_asset_depreciation` | `asset_id`; batch id; finance journal id |
| `AstAssetDisposal` | `ast_asset_disposal` | `asset_id` |
| `AstAssetRevaluation` | `ast_asset_revaluation` | `asset_id` |
| `AstAssetAudit` | `ast_asset_audit` | `asset_id`; auditor employee |
| `AstAssetDocument` | `ast_asset_document` | `asset_id`; URI + hash (not blob storage) |
| `AstAssetChecklist` | `ast_asset_checklist` | optional asset / maintenance / audit; `items_json` |
| `AstAssetMeterReading` | `ast_asset_meter_reading` | `asset_id` |
| `AstAssetNotification` | `ast_asset_notification` | optional `asset_id`; delivery status |
| `AstAssetReport` | `ast_asset_report` | snapshot metadata + payload |
| Incoming | `ast_incoming_asset_line`, `ast_incoming_asset_unit`, `ast_incoming_arrival_event`, `ast_incoming_qc_event` | GRN/PO/product UUIDs (no FK to procurement tables); units link to `registered_asset_id` |
| `AstDocumentSequence` | `ast_document_sequence` | Per-entity document numbering |

**Lifecycle enums** (see `domain/enums.py`): `AssetStatus`, `AssetOperationalStatus`, assignment/transfer/maintenance/disposal/revaluation/audit/document/checklist/meter/notification/report statuses, incoming arrival/QC/registration statuses, component types and issue statuses, delivery-challan statuses.

**Create DTO required fields (`AssetCreate`):** `branch_id`, `asset_name`, `asset_category_id`, `asset_type`, `purchase_date`, `purchase_cost`. Optional: serial, make/model/configuration, `location_label`, incoming unit/line ids, GRN/PO, etc.

**Asset type check constraint:** `'fixed','consumable','digital','leased'`.

**Depreciation methods:** `'straight_line','wdv','units_of_production'`.

**Allocation types:** `'employee','department','project','branch','warehouse'`.

### 2.4 Business logic / validation (services)

| Concern | Where | Behavior (as coded) |
|---|---|---|
| Registration | `registration_validator.py`, `asset_service.py` | Unique serial; category must exist; on approve, link `master.master_asset`; set ops READY_TO_MOVE; optional location row from `location_label` |
| Operational transitions | `operational_status_rules.py`, `asset_operational_status_service.py` | Locked matrix (READY↔ASSIGNED, ASSIGNED→RETIRED/PENDING, RETIRED→PENDING, PENDING→DISPOSED or READY). DISPOSED is terminal |
| Assignment | `assignment_validator.py` | Asset must be assignable lifecycle + READY_TO_MOVE; exclusive current assignment; block if pending transfer; allocation field required per type; return condition maps to ops (good→READY, outdated→RETIRED, dead→PENDING_DISPOSAL); component_returns required when issued components exist |
| Transfer | `transfer_validator.py`, `transfer_service.py` | Transfer branch must match asset branch; create strips duplicate `asset_id` from `**fields` (comment cites BUG-TRF-CREATE-01) |
| Maintenance / transfer vs ops | `OPS_BLOCKED_FOR_MAINTENANCE_OR_TRANSFER` | RETIRED / PENDING_DISPOSAL / DISPOSED blocked |
| Start disposal / reinstate | `retirement_service.py`, `reinstate_service.py` | Explicit actions only; not implicit on return |
| Depreciation | `depreciation_service.py` | `generate_period_run` creates drafts only; calculate then post; reverse via finance adapter |
| Finance post | `adapters/finance_port.py` | Requires `branch_id`; creates SYSTEM journal via Finance `JournalService` + `PostingService` |
| Governance | `governance_service.py`, `workflow_governance_settings.py` | When `ASSET_WORKFLOW_GOVERNANCE_ENABLED`, submit creates Foundation workflow instance; SOD errors exist (`SegregationOfDutiesError`) |
| Incoming | `incoming_asset_service.py`, `incoming_qc_service.py` | Arrival qty ≤ expected; QC accept+reject ≤ arrived; does not create `ast_asset` or inventory quarantine |
| Registration queue | `incoming_registration_service.py` | Only QC-accepted units; Excel validate/confirm can activate |
| Excel import | `asset_excel_import_service.py` | Orchestrates AssetService + AssignmentService + ops status; not a separate CRUD surface |
| Discovery | `discovery_service.py` | Parse OS command output into profile; apply with version/optimistic lock |
| Document numbers | `document_number_service.py` | Prefixes AST-, AASN-, ATRF-, … (`CODE_PREFIXES`) |
| Scope | `asset_scope_validator.py` | Tenant/company/branch access |

Category list handler paginates **in memory** after `AssetCategoryService.list` returns the full set (`total = len(items)` in `routers/__init__.py` ~194–198). Other aggregates use repository `search(..., offset, limit)` returning `(items, total)`.

### 2.5 Background jobs, webhooks, integrations

**Celery (`tasks.py`):**

| Task name | What it does |
|---|---|
| `asset.maintenance_due_alerts` | Counts active maintenance plans; **does not send notifications** |
| `asset.warranty_expiry_alerts` | Counts active warranties; **no send** |
| `asset.insurance_expiry_alerts` | Counts active insurances; **no send** |
| `asset.depreciation_scheduler` | Creates draft depreciation rows if `tenant_id`, `company_id`, `user_id` provided; otherwise `skipped`; never calculates or posts |
| `asset.asset_audit_reminders` | Lists planned audits (up to 100 document numbers); **no send** |
| `asset.retry_finance_posting` | Lists failed depreciation rows; **does not auto-post** |

**No inbound webhooks** in this module.

**Outbound integrations (adapters):**

- Foundation Workflow / Audit / Notification
- Finance journals (depreciation, disposal, revaluation post)
- Master Data (`master_asset`, product, vendor, employee)
- Organization (branch, department)
- Procurement read (GRN prefill / incoming sync)
- Payroll port (present; used for employee-related reads if called)

---

## 3. Frontend Analysis

### 3.1 Pages / screens and routes

Layout: `apps/web/src/app/(app)/assets/layout.tsx` always wraps children with `AssetsModuleSidebar`.

| Route | Page file | Screen component |
|---|---|---|
| `/assets` | `page.tsx` | `AssetOperationsContainer` → dashboard |
| `/assets/[resource]` | `[resource]/page.tsx` | Resource switch (see below) |
| `/assets/assets/new` | `assets/new/page.tsx` | `AssetAddForm` |
| `/assets/assets/[assetId]` | `assets/[assetId]/page.tsx` | `AssetDetailWorkspacePage` |
| `/assets/asset-assignments/new` | `asset-assignments/new/page.tsx` | `AssignmentWizardContainer` (Issue) |
| `/assets/asset-assignments/return` | `asset-assignments/return/page.tsx` | `ReturnWizardContainer` |
| `/assets/information-portal/[assetId]` | … | `AssetInformationPortal` |
| `/assets/self-service/[assetId]` | … | `AssetSelfServiceView` |
| `/assets/inventory-import` | `inventory-import/page.tsx` | `ExcelImportContainer` |

`[resource]/page.tsx` maps `getResource("assets", resourceKey)`:

| `resource` key | Component |
|---|---|
| `assets` | `AssetInventoryContainer` |
| `incoming-assets` | `IncomingAssetsWorkspace` |
| `incoming-assets-qc` | `IncomingAssetsQcWorkspace` |
| `asset-registration` | `AssetRegistrationQueueWorkspace` |
| `asset-categories` | `AssetCategoryWorkspace` |
| `asset-assignments` | `AssetAssignmentWorkspace` |
| `asset-transfers` | `AssetTransferWorkspace` |
| `asset-maintenances` | `AssetMaintenanceWorkspace` |
| `asset-disposals` | `AssetDisposalWorkspace` |
| `asset-depreciations` | `AssetDepreciationWorkspace` |
| `asset-revaluations` | `AssetRevaluationWorkspace` |
| `asset-audits` | `AssetAuditWorkspace` |
| `asset-warranties` | `AssetWarrantyWorkspace` |
| `asset-insurances` | `AssetInsuranceWorkspace` |
| `maintenance-plans` | `AssetMaintenancePlanWorkspace` |
| `asset-locations` | `AssetLocationWorkspace` |
| `service-histories` | `AssetServiceHistoryWorkspace` |
| `asset-checklists` | `AssetChecklistWorkspace` |
| `meter-readings` | `AssetMeterReadingWorkspace` |
| `asset-documents` | `AssetDocumentWorkspace` |
| `asset-components` | `AssetComponentsWorkspace` |
| `asset-notifications` | `AssetNotificationWorkspace` |
| `reports` | `AssetReportsWorkspace` |
| `qr-barcode` | `AssetQrWorkspacePage` |
| `asset-types` | `AssetTypesWorkspace` |
| `settings` | `AssetSettingsWorkspace` |
| `locations` | `AssetLocationsPlaceholderWorkspace` |
| `departments` | `AssetOrgMasterWrapper` |
| fallback | generic `ResourceListView` |

### 3.2 Component trees (major screens)

**App chrome (not module-owned, always wraps):**  
`AppShell` → optional `AppSidebar` (`h-dvh` + `overflow-y-auto`) + `AppTopbar` + `<main>` → assets layout.

**Assets layout:**  
`AssetsModuleSidebar` + `{children}`.

**Dashboard `/assets`:**

```
AssetOperationsContainer
  └─ AssetOperationsDashboard
       ├─ PageHeader (+ Bell/User placeholder icon buttons, BranchSelector)
       ├─ StatCard × N (KPIs)
       ├─ QueueCard (ready / disposal / assignments)
       ├─ QuickActionCard grid
       └─ BranchBreakdownSection (when branch = All)
```

**Inventory `/assets/assets`:**

```
AssetInventoryContainer
  ├─ AssetInventoryWorkspace
  │    ├─ PageHeader + BranchSelector + quick search
  │    ├─ InventoryFilterBar
  │    ├─ InventoryExportToolbar (Excel/CSV export only)
  │    ├─ preset tabs
  │    ├─ table / InventoryRegisterGroups (expandable rows)
  │    ├─ InventoryActionMenu
  │    └─ AssetDetailDrawer
  │         ├─ summary / configuration / assignment / assignment-history / additional-info / quick-links
  │         └─ drawer-skeleton
  ├─ StartDisposalConfirmDialog
  └─ ReinstateConfirmDialog
```

**Add Asset `/assets/assets/new`:**

```
AssetAddForm
  ├─ optional Incoming/QC source Card
  ├─ section Basic
  ├─ section IT Information (conditional hardware)
  ├─ section Location (city/building from ASSET_SITE_CATALOG)
  ├─ purchase/cost fields
  └─ submit (create → submit → approve in one click)
```

**Issue wizard `/assets/asset-assignments/new`:**

```
AssignmentWizardContainer
  └─ AssignmentWizard
       └─ WizardShell
            ├─ WizardStepper (lg vertical)
            ├─ WizardProgressBar (mobile)
            ├─ EmployeeStep | AssetStep | IssuedItemsStep | DeliveryStep | AssignmentReviewStep
            └─ WizardFooter (Back / Next / Save draft / Finish)
```

**Return wizard:** same shell; steps Summary / Condition / Components / Remarks / Review.

**Typical document workspace** (assignment, transfer, maintenance, disposal, …): list + filters + pagination + create panel/modal + selected-row actions (submit/approve/reject/…). Pattern repeated across `asset-*-workspace.tsx` files; local `useState` for rows, selected, draft, filters.

**Asset detail `/assets/assets/[assetId]`:**  
`AssetDetailWorkspace` — header/status, register fields, assignment snapshot, discovery panel (IT categories), start-disposal / reinstate dialogs, links to QR and issue/return.

### 3.3 State management

- **Local React state** in each workspace/container.
- **No global store** for assets.
- Inventory list UI snapshot: `inventory/inventory-ui-state.ts` (save/peek/clear).
- Stale-list signal after issue/return: `inventory/inventory-refresh.ts`.
- Navigation helpers: `navigation/use-asset-navigation.ts`, `assignment-navigation.ts`, `dashboard-navigation.ts`.
- Data fetching: direct `resourceService` / typed services in `assets-service.ts` and `assignment-frontend-service.ts` (no cache layer).

### 3.4 Forms

| Form | Steps | Validation | Library |
|---|---|---|---|
| Add Asset | **1 page**, 3+ sections (Basic, IT Information, Location, purchase) | Custom `validate()` + `fieldErrors`; inline messages | Native controlled inputs + ShadCN Select. **Not** react-hook-form / Zod |
| Issue assignment wizard | **5 steps** (`ASSIGNMENT_WIZARD_STEPS`) | Per-step `validateAssignmentStep`; finish re-validates steps 0–3 | Local state |
| Return wizard | **5 steps** (`RETURN_WIZARD_STEPS`) | `validateReturnStep` is effectively a no-op (`null`) | Local state |
| Excel import | **6 named steps** (select, parse, template, mapping, validate, preview) | Client template/row validator then API import | `xlsx` parse + local mapping |
| Document workspaces (create) | Usually **1 panel/modal** on the list page | Ad-hoc required fields / API 422 | Local state |
| Disposal post | Same workspace | Raw UUID text inputs for debit/credit/fiscal year | Local state |

Add Asset submit path (`asset-add-form.tsx` `submit()`): `create` → `submit` → `approve` in one user action, with retry if activation incomplete.

---

## 4. UI/UX Inventory

### 4.1 Distinct screens / layout patterns

| Screen | Purpose | Layout pattern |
|---|---|---|
| Dashboard | Ops KPIs, queues, quick actions | Single page, card grid |
| Inventory | Search/filter/export register | Single page + **drawer** for detail |
| Add Asset | Register IT asset | Single scrollable page, **section cards** |
| Asset detail | Full record, discovery, lifecycle actions | Single page, cards |
| Incoming / QC / Registration queue | Receiving pipeline | Single page list + action dialogs |
| Categories | Taxonomy CRUD | List + create/edit panel |
| Asset Types | Read-only PRD catalog | Single page table |
| Locations (config) | Future Asset Location Master | **Placeholder card** |
| Departments | Org departments | PageHeader + `ResourceListView` |
| Assignment list | Documents + inline create | List + form panel / modal |
| Issue wizard | Create assignment | **Stepper/wizard** |
| Return wizard | Return assignment | **Stepper/wizard** |
| Transfer / Maintenance / Disposal / Depreciation / Revaluation / Audit / Warranty / Insurance / Plans / History / Checklists / Meters / Documents / Components / Notifications / Reports | Entity CRUD + workflow | List + filters + side/detail or inline form |
| QR / Barcode | Lookup + print QR of self-service URL | Single page |
| Information portal / self-service | Redacted asset profile | Single page |
| Excel import | Bulk register | **Horizontal stepper** |
| Settings | Governance notes | Static cards |

### 4.2 Sidebar / navigation (this module)

**Primary module nav:** `AssetsModuleSidebar` (`assets-module-sidebar.tsx`) driven by `assetManagementNav` in `config/assets.ts`.

Groups and items:

1. **Assets** — Dashboard, All Assets, Incoming Assets, Incoming QC, Pending Registration, Add Asset  
2. **Configuration** — Categories, Asset Types, Locations, Departments  
3. **Operations** — Asset Assignment, Transfers, Maintenance  
4. **Lifecycle** — Disposal  
5. **Extended** — Components, Documents, QR / Barcode, Reports  

Desktop: 64px icon rail (`w-16`) that expands to 256px on hover/focus (`hover:w-64`). `max-h-[calc(100dvh-5.5rem)] overflow-y-auto`. Sticky `lg:top-4`.  
Mobile: full-label stacked nav (`lg:hidden`).

Active state: `aria-current="page"`, `bg-primary/10` + inset primary ring; special case so `/assets/assets/new` does not mark All Assets active.

**App-level sidebar:** `AppSidebar` still present unless `?standalone=1` / session `erp-standalone`. Module links open **new tab** with `standalone=1` (`standaloneHref` in `app-sidebar.tsx`). CRM/Projects get dedicated sidebars in standalone; **Assets does not** — it uses `AssetsModuleSidebar` from the assets layout instead.

**Dead / unused nav:** `AssetsWorkspaceNav` (`assets-workspace-nav.tsx`) is **not imported** by any page. It lists Overview, Assets, Assignments, Transfers, Maintenance, Depreciation, Disposals, Audits (includes items hidden from the locked rail).

**Dashboard vs rail mismatch:** `assetsWorkspaceGroups` / `assetsPipelineStages` / `assetsQuickLinks` still point at depreciations, revaluations, audits, warranties, insurance, maintenance-plans, etc.

### 4.3 Reusable UI

**Design-system / ShadCN:** `Button`, `Card`, `Input`, `Label`, `Select`, `Badge`, `PageHeader`.

**Module-shared (`components/assets/shared/`):** `StatusBadge`, `EmptyState`, `TableRowsSkeleton` / loading skeleton, `InventoryFilterBar`, `BranchSelector`, `StatCard`, `QueueCard`, `QuickActionCard`, `asset-status` helpers.

**One-off / feature-specific:** assignment wizard shell/stepper/footer, inventory drawer sections, excel import panels, confirm dialogs, discovery panel, QR canvas, register-groups, export toolbar, placeholder locations workspace, settings copy cards, org-master wrapper.

Icons: Lucide only (`Package`, `Wrench`, `QrCode`, …). `UserCheck` is used for **both** Departments and Asset Assignment in `config/assets.ts`.

---

## 5. Functionality Inventory

Status legend: **working** = implemented in API + UI with tests (not live-verified this pass); **partially working** = UI or API incomplete vs. labeled purpose; **not implemented** = placeholder / stub; **unclear** = needs runtime proof.

| Feature / action | Status | Notes |
|---|---|---|
| Dashboard KPIs / queues | working | `dashboard-summary` + list fetches; Bell/User buttons are placeholders |
| Inventory search / filters / pagination | working | Server-side filters on register GET |
| Inventory export Excel/CSV | working | Client export from fetched pages |
| Inventory detail drawer | working | |
| Inventory issue / return / start-disposal / reinstate actions | working | Gated by ops status + permissions |
| Add Asset (manual) | working | Auto submit+approve; location from **hardcoded site catalog** |
| Incoming arrive | working | Empty queue blocked historical E2E (data, not code) |
| Incoming QC accept/reject | working | |
| Pending registration → Add Asset prefill | working | |
| Registration Excel template/validate/confirm | working (API+queue UI) | |
| Categories CRUD / deactivate | working | In-memory pagination |
| Asset Types CRUD | not implemented | Read-only UI catalog; API uses `asset_type` enum |
| Configuration Locations | not implemented | `AssetLocationsPlaceholderWorkspace` — Phase R1 copy |
| Departments | partially working | Read-only org `ResourceListView` |
| Assignment list + workflow | working | Also a 5-step wizard for issue |
| Assignment return | working | 5-step wizard; backend validates component_returns |
| Transfer CRUD + workflow | working (code) | Historical E2E FAIL (asset_id kwarg) **appears fixed** in `transfer_service.py` 107–119; not re-run live |
| Maintenance WO workflow | working | |
| Disposal workflow | working | POST to finance **blocked** if no open fiscal period (env) |
| Start disposal / reinstate | working | |
| Components install/replace/dispose/tree | working | |
| Documents metadata CRUD | partially working | URI + hex digest, not file upload |
| QR generate / print | partially working | Encodes self-service URL; search-by-code; **no camera barcode scan** |
| Reports catalog/run/export | working | |
| Excel register import UI | working but **orphaned from nav** | `/assets/inventory-import` only |
| Depreciation generate/calc/post | working (UI off-sidebar) | Scheduler does not post |
| Revaluation / audits / warranties / insurance / plans / history / checklists / meters / asset-location history / asset-notifications | working (UI off-sidebar) | Reachable by URL / dashboard cards |
| Settings | not implemented | Static documentation |
| IT discovery parse/apply | working | On detail for IT categories |
| Information portal / self-service | working | Authenticated; same redaction |
| Bulk actions (multi-select) | not implemented | No multi-select on inventory |
| Physical DELETE | not implemented | By design (soft cancel/archive) |
| Celery expiry emails | not implemented | Count-only stubs |
| Dashboard notification/profile | not implemented | Buttons with `aria-label="… (placeholder)"` |
| Wizard mock employees/assets | N/A (dev fallback) | `wizard-mock-data.ts` is default prop if container omits lists |

---

## 6. Dependencies & Integrations

**This module calls**

| System | How |
|---|---|
| Foundation RBAC | `require_permission("asset.*")`; 90 codes in `permissions.py` |
| Foundation Workflow | `AssetGovernanceService` + `wf_instance` FK when governance flag on |
| Foundation Audit | `AuditService.log_entity_change` |
| Foundation Notification | `NotificationService.send` when template exists (`workflow_codes.py`) |
| Organization | Branch access, departments (`AssetOrganizationAdapter`); UI `/departments` |
| Master Data | Employee, vendor, product, `master_asset` on approve |
| Procurement | GRN prefill, incoming line sync (`ProcurementReadPort`) |
| Finance | SYSTEM journals on depreciation/disposal/revaluation **post** |
| Payroll port | Adapter present for employee-related reads |

**This module is called by**

- Web app under `/assets/*` only (no other module routers import asset services in the traced graph except finance/org/master as **callees**).
- Celery beat (if scheduled) for the six `asset.*` task names.

**Third-party**

- Browser `xlsx` for import parse; `qrcode.react` for labels; `jspdf` for some report/export paths; `recharts` on reports workspace. No external asset-tag SaaS.

**Hardcoded frontend catalogs (not APIs)**

- `config/asset-prd-types.ts` — PRD type names mapped to API `asset_type`
- `config/asset-it-config-rules.ts` — which types require processor/RAM/storage
- `config/asset-site-catalog.ts` — city / building options for Add Asset location label

---

## Appendix A — Permission catalog

90 codes in `ASSET_PERMISSIONS` (`permissions.py`), grouped as `asset.{resource}:{action}` for category, asset, component, assignment, transfer, location, warranty, insurance, maintenance_plan, maintenance, depreciation, disposal, revaluation, audit, document, checklist, meter, notification, report, incoming, incoming_qc.

Role slices: `ASSET_EXECUTIVE_PERMISSIONS` (excludes approve/post/calculate), `ASSET_MANAGER_PERMISSIONS` / `ASSET_ADMIN_PERMISSIONS` (all), `ASSET_AUDITOR_PERMISSIONS` (read + audit.* + report.*).

---

## Appendix B — Historical runtime evidence (not this pass)
`docs/ASSET_MANAGEMENT_E2E_VERIFICATION_REPORT.md` (2026-08-09, branch `asset_phase1`): 97 PASS / 1 FAIL (Transfer create TypeError) / 4 BLOCKED (empty incoming queue, finance period for disposal post). UI route smoke 200s. Treat as historical; transfer create code now contains an explicit fix comment.