# Asset Module — Current Working Workflow & Status

**Scope:** Asset Management only (`apps/api/src/modules/asset/**`, `apps/web` Assets UI)  
**Method:** Live codebase inspection (August 2026)  
**API base:** `/api/v1/assets`  
**UI base:** `/assets`  
**Constraint:** This document describes current state only. No code was changed to produce it.

---

## 1. Status legend

| Status | Meaning |
|--------|---------|
| **Working** | Opens, calls API, core happy path usable in local/dev |
| **Partial** | Screen/API exists; missing fields, silent failures, or incomplete persist |
| **Breaking risk** | Can open but known failure modes (validation, payload mismatch, silent swallow) |
| **Shell / Placeholder** | Route opens with static or UI-only content; little/no live API |
| **Untouched / Orphan** | Backend or frontend exists but not wired into nav, or Celery stub only |
| **Not built** | No meaningful UI and/or no dedicated API surface |

---

## 2. End-to-end working workflows (happy paths)

### 2.1 Register → Activate → Inventory

```text
Add Asset wizard (/assets/assets/new)
  → POST /assets/assets          (create draft; system assigns asset_code/document_number)
  → PATCH /assets/assets/{id}    (optional QR = self-service URL)
  → POST …/submit + …/approve    (wizard tries auto-activate; errors may be swallowed)
  → Detail /assets/assets/{id}
  → Appears on All Assets (/assets/assets) + Dashboard queues by operational_status
```

| Step | Status | Notes |
|------|--------|-------|
| Create with name, category, branch, cost, type, serial | **Working** | Branch is dropdown (not raw UUID) |
| User-entered Asset Code | **Partial** | UI collects it; API strips `asset_code` and generates its own |
| Location step (label/building/floor/room) | **Partial** | UI only — **not sent on create** |
| Technical step (hostname/MAC) | **Partial** | UI only — **not sent on create** |
| Persist create (DB commit) | **Working** | Fixed via asset `get_db` commit-on-success |
| Auto submit/approve | **Breaking risk** | `.catch(() => undefined)` hides workflow failures |
| Show on All Assets | **Working** | Was blank when assignments `page_size=500` caused 422; now capped/paginated at 200 |

### 2.2 Issue (assign) → Return

```text
Inventory / Assignment workspace
  → Issue wizard /assets/asset-assignments/new?assetId=…
  → Draft → Submit → Approve (READY_TO_MOVE → ASSIGNED)
  → Return wizard /assets/asset-assignments/return?…
  → POST …/return (condition + remarks) → asset READY_TO_MOVE again
```

| Path | Status |
|------|--------|
| Assignment list workspace | **Working** |
| Issue wizard (container-hosted) | **Working** |
| Return wizard | **Working** |
| Detail page “quick return” without body | **Breaking risk** | May omit required `return_condition` |

### 2.3 Transfer / Maintenance / Disposal / Revaluation

```text
Create draft on workspace → submit → approve/reject → (disposal/reval: post to finance)
```

| Feature | Status |
|---------|--------|
| Transfers | **Working** (API + UI workspace) |
| Maintenance WO | **Working** (+ schedule/start/complete) |
| Disposal | **Working** (+ post) |
| Revaluation | **Working** (+ post) |

### 2.4 Discovery (IT) → Portal / Self-service / QR

```text
IT asset detail → Discovery panel (command → parse → apply)
Information portal / Self-service (redacted read)
QR workspace → client QR pointing at /assets/self-service/{id}
```

| Feature | Status |
|---------|--------|
| Discovery parse/apply | **Working** (API + detail panel) |
| Information portal | **Working** |
| Self-service page | **Working** (same redacted payload; no signed public token yet) |
| QR generate/print | **Working** (client-side; no server QR image API) |

### 2.5 Excel import

```text
/assets/inventory-import → map/validate → POST /assets/assets/import
```

| Feature | Status |
|---------|--------|
| Import UI + API | **Working** |
| Sidebar entry | **Orphan** — reachable by URL only |

---

## 3. Backend overview

### 3.1 Architecture

```text
Router (routers/__init__.py)
  → Service
    → Validator / Engine
      → Repository
        → PostgreSQL (schema asset / ast_*)
```

- **Clean Architecture / DDD modular monolith** (per platform lock).
- **Permissions:** `asset.<resource>:<action>` (e.g. `asset.asset:create`, `asset.assignment:return`).
- **Tenant scope:** `tenant_id` / `company_id` / `branch_id` filters on repos.
- **Soft delete columns** exist on AST tables; **almost no soft-delete HTTP APIs** (lifecycle uses status actions instead).
- **Unit of work:** `modules/asset/dependencies.py` `get_db` → **commit on success / rollback on error** (required so create + follow-up PATCH work).

### 3.2 Backend feature matrix

| Area | Prefix (under `/api/v1/assets`) | Depth | Status |
|------|----------------------------------|-------|--------|
| Categories | `/asset-categories` | CRUD + deactivate/reactivate | **Working** |
| Asset register | `/assets` | CRUD + WF submit/approve/reject/cancel/reopen/resubmit | **Working** |
| Dashboard summary | `/assets/dashboard-summary` | Aggregations by operational status | **Working** |
| Excel import | `/assets/import` | Structured import body | **Working** |
| Discovery | `/assets/discovery/command`, `/{id}/discovery/parse\|apply` | Parse + apply profile | **Working** |
| Information portal | `/{id}/information-portal` | Redacted read | **Working** |
| Self-service | `/{id}/self-service` | Alias of portal | **Working** (auth still app session) |
| Components | `/asset-components` | CRUD + tree/history/replace/dispose | **Working** |
| Assignments | `/asset-assignments` | CRUD + WF + return | **Working** |
| Transfers | `/asset-transfers` | CRUD + WF | **Working** |
| Asset locations | `/asset-locations` | CRUD + complete | **Working** (update perm = create) |
| Warranties | `/asset-warranties` | CRUD + activate/extend/expire | **Working** |
| Insurance | `/asset-insurances` | CRUD + activate/renew/expire/close | **Working** |
| Maintenance plans | `/maintenance-plans` | CRUD + activate/pause/resume/close | **Working** |
| Maintenance | `/asset-maintenances` | CRUD + WF + schedule/start/complete | **Working** |
| Service history | `/service-histories` | List/get/create only | **Partial** |
| Depreciation | `/asset-depreciations` | CRUD + generate-run/calculate/post/reverse | **Working** (no approval WF) |
| Disposals | `/asset-disposals` | CRUD + WF + post | **Working** |
| Revaluations | `/asset-revaluations` | CRUD + WF + post | **Working** |
| Audits | `/asset-audits` | CRUD + start/complete/cancel | **Working** |
| Documents | `/asset-documents` | CRUD + supersede/archive | **Working** |
| Checklists | `/asset-checklists` | CRUD + complete/cancel | **Working** |
| Meter readings | `/meter-readings` | List/get/create + void (no PATCH) | **Partial** |
| Notifications | `/asset-notifications` | CRUD + archive/read/sent/failed | **Working** |
| Reports | `/reports` | Catalog/dashboard/run/export/generate/finalize | **Working** |
| Operational status | *(no dedicated REST)* | Transitions via assignment/disposal/approve | **Working** (composed) |
| Soft-delete APIs | — | Columns only | **Not built** |
| Celery expiry/alerts | `tasks.py` | Mostly count/list | **Stub / Untouched** |
| Depreciation approval WF | constant only | No seed / no approve API | **Not built** |

### 3.3 Workflow engines (seeded)

| Entity | Workflow code | Status |
|--------|---------------|--------|
| Asset | `AST_ASSET_APPROVAL` | **Working** |
| Assignment | `AST_ASSIGNMENT_APPROVAL` | **Working** |
| Transfer | `AST_TRANSFER_APPROVAL` | **Working** |
| Maintenance | `AST_MAINTENANCE_APPROVAL` | **Working** |
| Disposal | `AST_DISPOSAL_APPROVAL` | **Working** |
| Revaluation | `AST_REVALUATION_APPROVAL` | **Working** |
| Depreciation | *(unused constant)* | **Not built** |

### 3.4 Operational status values

`READY_TO_MOVE` · `ASSIGNED` · `RETIRED` · `PENDING_DISPOSAL` · `DISPOSED`

Used by inventory presets, dashboard summary, assignment/disposal side effects.

---

## 4. Frontend overview

### 4.1 Stack & entry

- Next.js App Router under `apps/web/src/app/(app)/assets/**`
- Workspaces in `apps/web/src/components/assets/**`
- Services: `assets-service.ts`, `assignment-frontend-service.ts`
- Sidebar: `config/assets.ts` → `assetManagementNav` (locked structure)

### 4.2 Sidebar → route → status

#### Ungrouped

| Nav | Route | UI | Status |
|-----|-------|-----|--------|
| Dashboard | `/assets` | Ops dashboard (KPIs, queues, recent assignments) | **Working** |
| QR / Barcode | `/assets/qr-barcode` | Search asset, QR to self-service, print | **Working** |
| Reports | `/assets/reports` | Tabs: dashboard / run / snapshots | **Working** |
| Settings | `/assets/settings` | Static notes + link to foundation | **Shell** |

#### Assets

| Nav | Route | UI | Status |
|-----|-------|-----|--------|
| All Assets | `/assets/assets` | IT Asset Inventory: presets, filters, table, drawer, export | **Working** |
| Add Asset | `/assets/assets/new` | 6-step wizard | **Partial** (see §2.1) |

#### Asset Configuration

| Nav | Route | UI | Status |
|-----|-------|-----|--------|
| Categories | `/assets/asset-categories` | List + create/edit + deactivate | **Working** |
| Asset Types | `/assets/asset-types` | Read-only PRD type catalog | **Shell** (no dedicated API) |
| Locations | `/assets/locations` | Org locations read-only wrapper | **Working** (org master) |
| Departments | `/assets/departments` | Org departments read-only wrapper | **Working** (org master) |

#### Operations

| Nav | Route | UI | Status |
|-----|-------|-----|--------|
| Asset Assignment | `/assets/asset-assignments` | List + modal WF + links to wizards | **Working** |
| Transfers | `/assets/asset-transfers` | List + create/update + WF | **Working** |
| Maintenance | `/assets/asset-maintenances` | List + create/update + WF + lifecycle | **Working** |

#### Lifecycle

| Nav | Route | UI | Status |
|-----|-------|-----|--------|
| Depreciation | `/assets/asset-depreciations` | List + calculate/post/reverse flows | **Working** |
| Disposals | `/assets/asset-disposals` | List + WF + post | **Working** |
| Revaluation | `/assets/asset-revaluations` | List + WF + post | **Working** |

#### Compliance

| Nav | Route | UI | Status |
|-----|-------|-----|--------|
| Audits | `/assets/asset-audits` | List + start/complete/cancel | **Working** |
| Warranties | `/assets/asset-warranties` | List + activate/extend/expire | **Working** |
| Insurance | `/assets/asset-insurances` | List + activate/renew/expire/close | **Working** |

#### Extended

| Nav | Route | UI | Status |
|-----|-------|-----|--------|
| Components | `/assets/asset-components` | Install/replace/dispose + tree | **Working** |
| Asset Locations | `/assets/asset-locations` | Custody location history | **Working** |
| Maintenance Plans | `/assets/maintenance-plans` | Plans activate/pause/resume/close | **Working** |
| Service History | `/assets/service-histories` | Append-mostly list/create | **Partial** |
| Checklists | `/assets/asset-checklists` | Complete/cancel | **Working** |
| Meter Readings | `/assets/meter-readings` | Create + void | **Partial** |
| Documents | `/assets/asset-documents` | Metadata CRUD (+ supersede/archive); not full multipart upload UX | **Partial** |
| Notifications | `/assets/asset-notifications` | Local notification records | **Working** |

### 4.3 Routes not in sidebar (deep-link / orphan)

| Route | Purpose | Status |
|-------|---------|--------|
| `/assets/assets/[assetId]` | Asset detail + tabs + discovery | **Working** (return shortcut **Breaking risk**) |
| `/assets/asset-assignments/new` | Issue wizard | **Working** |
| `/assets/asset-assignments/return` | Return wizard | **Working** |
| `/assets/information-portal/[assetId]` | Redacted portal | **Working** |
| `/assets/self-service/[assetId]` | Self-service view | **Working** |
| `/assets/inventory-import` | Excel import | **Working** but **Orphan from nav** |

### 4.4 Inventory UI tabs / presets (All Assets)

| Preset / control | Behavior | Status |
|------------------|----------|--------|--------|
| All Assets | No operational filter | **Working** |
| Ready To Move | `operational_status=READY_TO_MOVE` | **Working** |
| Assigned | `ASSIGNED` | **Working** |
| Retired | `RETIRED` | **Working** |
| Pending Disposal | `PENDING_DISPOSAL` | **Working** |
| Disposed | `DISPOSED` | **Working** |
| Filters (branch, category, dept, type, location, search) | Server + client filters | **Working** |
| Row actions (Assign / Return / Transfer / …) | Navigation + permissions | **Working** |
| Export CSV/XLSX | Client export via paginated APIs (page_size ≤ 200) | **Working** |
| Detail drawer | In-place drawer | **Working** |

### 4.5 Add Asset wizard steps

| Step | UI fields | Persisted on create? | Status |
|------|-----------|----------------------|--------|
| Basic | Name, code, serial, **branch** | Name, serial, branch; code ignored by API | **Partial** |
| Classification | Category, PRD type → asset_type | Category + type | **Working** |
| Details | Purchase date/cost/currency | Yes | **Working** |
| Location | Label, building, floor, room | **No** | **Partial / Untouched persist** |
| Technical | Hostname, MAC (IT categories) | **No** | **Partial / Untouched persist** |
| Review | Summary + Create | Create + QR update + silent submit/approve | **Partial** |

### 4.6 Asset detail tabs

| Tab | Content | Status |
|-----|---------|--------|
| Overview | Core fields, status, quick links | **Working** |
| Assignments | Related assignments | **Working** |
| Maintenance | Related WOs | **Working** |
| Documents | Related docs | **Working** |
| Activity | Activity/audit-ish surface | **Partial** (depth varies) |
| Discovery panel | IT assets | **Working** |

---

## 5. Feature × Backend × Frontend scorecard

| Feature | Backend | Frontend / Nav | Overall |
|---------|---------|----------------|---------|
| Ops dashboard | Working | Working | **Working** |
| Inventory register | Working | Working | **Working** |
| Add asset | Working | Partial wizard | **Partial** |
| Asset detail | Working | Working | **Working** |
| Categories | Working | Working | **Working** |
| Asset types | N/A (no API) | Shell | **Shell** |
| Org locations/depts | Org APIs | Working wrappers | **Working** |
| Assignment + issue/return wizards | Working | Working | **Working** |
| Transfers | Working | Working | **Working** |
| Maintenance | Working | Working | **Working** |
| Maintenance plans | Working | Working | **Working** |
| Depreciation | Working (no WF) | Working | **Working** |
| Disposal | Working | Working | **Working** |
| Revaluation | Working | Working | **Working** |
| Audits | Working | Working | **Working** |
| Warranties | Working | Working | **Working** |
| Insurance | Working | Working | **Working** |
| Components | Working | Working | **Working** |
| Asset locations | Working | Working | **Working** |
| Service history | Partial API | Working UI | **Partial** |
| Checklists | Working | Working | **Working** |
| Meter readings | Partial API | Working UI | **Partial** |
| Documents | Working (metadata) | Working UI; multipart gap | **Partial** |
| Notifications (asset-local) | Working | Working | **Working** |
| Reports | Working | Working | **Working** |
| QR / barcode | N/A (client) | Working | **Working** |
| Portal / self-service | Working | Working | **Working** |
| Discovery | Working | Detail panel | **Working** |
| Excel import | Working | Working, **not in sidebar** | **Working (orphan nav)** |
| Settings | N/A | Shell | **Shell** |
| Soft-delete APIs | Not built | Not built | **Not built** |
| Celery alert senders | Stub | N/A | **Untouched** |
| Server-side QR image | Not built | Client QR only | **Not built** |
| Signed public self-service token | Not built | Session-gated pages | **Not built** |

---

## 6. Recently fixed (relevant to “current working”)

These were broken in live use and are **fixed in the current tree** (do not re-diagnose as open bugs unless regressions appear):

| Issue | Symptom | Fix area |
|-------|---------|----------|
| Asset create not persisted | Create 200 → immediate PATCH **Asset not found** | Asset `get_db` commit-on-success |
| Branch as raw UUID | Confusing / empty → UUID validation errors | Add Asset branch dropdown |
| Select empty value look selected | Category looked set but stayed `""` | Shared `Select` placeholder + auto-select |
| Button `asChild` console error | Radix-style prop on Base UI Button | `button.tsx` clone child |
| Inventory **Validation error** | Assignments `page_size=500` > API max 200 | Inventory paginates at 200 + clamp in service |
| Alembic / missing columns | Dashboard/API errors on `operational_status` etc. | Migrations (incl. widen `alembic_version`, upgrade through later revisions) |

---

## 7. Known remaining gaps / break risks

1. **Add Asset** does not persist Location or Technical steps; user-entered asset code is ignored by API.
2. Wizard **submit/approve** failures are swallowed — asset may stay draft while UI navigates to detail.
3. Detail **quick return** may omit required return body fields.
4. **Documents**: metadata APIs exist; full multipart upload UX is incomplete vs FRD intent.
5. **Settings / Asset Types**: intentional shells.
6. **Excel import** works but is hidden from sidebar.
7. **Celery** warranty/insurance/maintenance/audit alert tasks do not send notifications (stubs).
8. Soft-delete columns unused by HTTP APIs.
9. No dedicated REST for operational-status transitions (by design via other flows).
10. Self-service is not a public signed-URL experience yet.

---

## 8. Recommended smoke checklist (manual)

Use after login (`admin@example.com` / configured password):

1. `/assets` — KPIs load (not “Cannot reach API”).
2. `/assets/assets` — rows appear; no red **Validation error**.
3. `/assets/assets/new` — pick branch + category → Create → lands on detail; asset visible in All Assets.
4. Issue from inventory → return via return wizard.
5. Open Categories, Assignments, Transfers, Maintenance, Reports — list loads.
6. `/assets/qr-barcode?assetId=…` — QR renders.
7. `/assets/settings` and `/assets/asset-types` — open as shells (expected).
8. `/assets/inventory-import` — page opens (URL only).

---

## 9. Source map (quick)

| Layer | Path |
|-------|------|
| API routers | `apps/api/src/modules/asset/routers/__init__.py` |
| API UoW / commit | `apps/api/src/modules/asset/dependencies.py` |
| API services/repos | `apps/api/src/modules/asset/service/**`, `repository/**` |
| Web sidebar | `apps/web/src/config/assets.ts` |
| Web pages | `apps/web/src/app/(app)/assets/**` |
| Web workspaces | `apps/web/src/components/assets/**` |
| Web services | `apps/web/src/services/assets-service.ts`, `assignment-frontend-service.ts` |

---

## 10. Bottom line

The Asset module is a **broad, largely implemented** modular slice: most sidebar workspaces are **wired to real FastAPI endpoints** with workflow actions. Day-to-day **inventory, assignment issue/return, transfers, maintenance, lifecycle finance docs, reports, QR, and portals** are in **Working** shape for local use after recent commit/pagination fixes.

What is **not** “done product-complete”:

- **Partial** Add Asset wizard (UI ahead of persist),
- **Shell** Settings + Asset Types,
- **Orphan** Excel import nav,
- **Stub** Celery alerts,
- **Not built** soft-delete APIs, server QR, public self-service tokens, depreciation approval WF.

Treat **Working** as “usable against current APIs,” not “FRD-complete / production-hardened.”
