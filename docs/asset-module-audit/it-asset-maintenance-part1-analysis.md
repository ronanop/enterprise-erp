# IT Assets — Maintenance: Full Feature Analysis (Part 1)

**Status:** Analysis only — no code or schema changes in this pass.  
**Scope:** IT Asset Maintenance **work orders** (`ast_asset_maintenance` / `/assets/asset-maintenances`). Related but separate: Maintenance Plans (`maintenance-plans`), Service History (`service-histories`), Non-IT maintenance dialogs.  
**Date:** 2026-08-31

---

## Summary table

| Area | Finding (one line) |
|------|--------------------|
| Primary UI | Single page `/assets/asset-maintenances` → `AssetMaintenanceWorkspace` (list + create draft + detail panel) |
| “Send to Maintenance” | **Navigate only** to `?assetId=…` — **no API create** |
| Prefill bug | `assetId` is **read** then **never applied** to the Create Draft form → looks like “nothing happened” |
| WO statuses | `draft` → `submitted` → `approved` → `scheduled` → `in_progress` → `completed`; plus `cancelled` (draft cancel or WF reject) |
| Engine location | Central `AssetMaintenanceEngine` + `MaintenanceValidator` + `MaintenanceService` (not ops-status matrix) |
| Lifecycle `ast_asset.status` | **Start** → `in_maintenance`; **Complete** (no other open WO) → `active` |
| Ops `operational_status` | **Never written** by Maintenance; gate only via `OPS_BLOCKED_FOR_MAINTENANCE_OR_TRANSFER` |
| Create required (API) | `branch_id`, `asset_id`, `maintenance_type` — all else optional |
| Reason / duration | **No columns** today — would be new |
| History | No WO timeline table; Foundation **audit** on transitions; **service history** row only on **complete** |
| List | All statuses mixed by default; optional status/type/`q` filters exist |
| Components (`IN_USE_AS_COMPONENT`) | **Blocked** from create/submit/approve/start (same ops block set) |

---

## 1. Full route / page map

### Frontend routes / pages

| Route | Component | File |
|-------|-----------|------|
| `/assets/asset-maintenances` | `AssetMaintenanceWorkspace` | `apps/web/src/app/(app)/assets/[resource]/page.tsx` (resource `asset-maintenances`) → `apps/web/src/components/assets/asset-maintenance-workspace.tsx` |
| `/assets/maintenance-plans` | `AssetMaintenancePlanWorkspace` | same `[resource]/page.tsx` → `asset-maintenance-plan-workspace.tsx` (**plans**, not work orders) |
| `/assets/service-histories` | `AssetServiceHistoryWorkspace` | `asset-service-history-workspace.tsx` (completed service events linked to WOs) |
| Inventory “Maintenance” action | Nav only | `apps/web/src/components/assets/navigation/asset-navigation.ts` |
| Asset detail “Maintenance” button | Link with `?assetId=` | `apps/web/src/components/assets/asset-detail-workspace.tsx` |

There is **no** dedicated create route (e.g. `/asset-maintenances/new`) and **no** dedicated detail route. Create draft + “Work order detail” are **side panels on the same list page**.

Config / sidebar:

- `apps/web/src/config/assets.ts` — Operations → Maintenance → `/assets/asset-maintenances`
- `apps/web/src/config/modules.ts` — resource key `asset-maintenances`, `apiPath: /assets/asset-maintenances`

### Backend endpoints

Mount: `/api/v1/assets` + router prefix `/asset-maintenances`  
Router: `apps/api/src/modules/asset/routers/__init__.py` (`asset_maintenances_router`)  
Service: `apps/api/src/modules/asset/service/maintenance_service.py`  
Repository: `apps/api/src/modules/asset/repository/asset_maintenance_repository.py`  
Engine: `apps/api/src/modules/asset/service/engines/asset_maintenance_engine.py`  
Validator: `apps/api/src/modules/asset/service/maintenance_validator.py`  
Model: `apps/api/src/modules/asset/models/asset_maintenance.py`  
Schemas: `AssetMaintenanceCreate` / `Update` / `Response` in `apps/api/src/modules/asset/schemas.py`

| Method | Path | Permission | Service method |
|--------|------|------------|----------------|
| GET | `/asset-maintenances` | `asset.maintenance:read` | `search` |
| GET | `/asset-maintenances/{id}` | `asset.maintenance:read` | `get` |
| POST | `/asset-maintenances` | `asset.maintenance:create` | `create` |
| PATCH | `/asset-maintenances/{id}` | `asset.maintenance:update` | `update` |
| POST | `…/submit` | `asset.maintenance:submit` | `submit` |
| POST | `…/approve` | `asset.maintenance:approve` | `approve` |
| POST | `…/reject` | `asset.maintenance:approve` | `reject` |
| POST | `…/cancel` | `asset.maintenance:create` | `cancel_draft` |
| POST | `…/reopen` | `asset.maintenance:create` | `reopen` |
| POST | `…/resubmit` | `asset.maintenance:submit` | `resubmit` |
| POST | `…/schedule` | `asset.maintenance:complete` | `schedule` |
| POST | `…/start` | `asset.maintenance:complete` | `start` |
| POST | `…/complete` | `asset.maintenance:complete` | `complete` |

List query params: `page`, `page_size`, `company_id`, `asset_id`, `branch_id`, `status`, `maintenance_type`, `q`.

Related (same permission family for read on histories):

- `GET/POST /service-histories` — gated with `asset.maintenance:read` / `create` (see router after maintenance block).

### Permissions (catalog)

Defined in `apps/api/src/modules/asset/permissions.py`:

| Code | Typical use |
|------|-------------|
| `asset.maintenance:read` | List / get WO; also service-history list |
| `asset.maintenance:create` | Create draft; cancel draft; reopen |
| `asset.maintenance:update` | Patch draft fields |
| `asset.maintenance:submit` | Submit / resubmit |
| `asset.maintenance:approve` | Approve **and** reject |
| `asset.maintenance:complete` | Schedule / start / complete |

Inventory menu visibility (`inventory-permissions.ts`): Maintenance shown if `asset.maintenance:create` **or** `asset.maintenance:read`, then further gated by operational status (see §2 / §7).

Workflow code (when governance enabled): `AST_MAINTENANCE_APPROVAL` / entity `ast_asset_maintenance` (`workflow_codes.py`). Documented steps: ASSET_EXECUTIVE → ASSET_MANAGER (`Asset_MNT_Feature_Package.md`).

---

## 2. “Send to Maintenance” from All Assets — bug diagnosis

### What the UI does today

1. Inventory row/menu action id: `"maintenance"` (`inventory-interaction.types.ts`).
2. `dispatchInventoryMenuAction` → `navigation.openMaintenance(assetId)`.
3. `openMaintenance` **only** pushes:

   `/assets/asset-maintenances?assetId={assetId}`

   (`asset-navigation.ts` lines 24–25, 63, 98–99).

4. Asset detail uses the same pattern: `<Link href={/assets/asset-maintenances?assetId=…}>`.

**It does not call `POST /asset-maintenances`.** No draft is created by this action alone.

### Does Create Draft consume `assetId`?

In `asset-maintenance-workspace.tsx`:

```ts
const prefillAssetId = searchParams.get("assetId") ?? "";
```

That variable is **never used again** (no `useEffect`, no `onDraftAssetChange(prefillAssetId)`). Draft state starts as empty `asset_id` / `branch_id`.

**Verdict:** This is a **UX / prefill gap**, not a backend create failure.

| Possibility | Confirmed? |
|-------------|------------|
| A. Backend fails silently when “sending” to maintenance | **No** — no create is attempted |
| B. User lands on Maintenance page; form empty; no new row in list → “nothing happened” | **Yes** — expected with current code |
| C. User must still pick asset + Create draft manually | **Yes** — that is the only path that creates a WO |

Secondary friction (after fixing prefill):

- Asset dropdown is loaded from only `status=active` and `status=in_maintenance`, each `page_size=100` — deep-linked asset may be missing from options even if prefill were wired.
- FE hides Maintenance for `ASSIGNED` (and terminal ops); BE also rejects create if an open assignment exists (`_validate_no_open_assignment`).

---

## 3. Full workflow — statuses and transitions

### Work-order statuses (`AssetMaintenanceStatus`)

From model check + enum (`asset_maintenance.py`, `enums.py`):

| Status | Meaning |
|--------|---------|
| `draft` | Editable WO; created by POST |
| `submitted` | Awaiting WF approval (or legacy path) |
| `approved` | Approved; can schedule / start / complete |
| `scheduled` | Scheduled date set/advanced; can start / complete |
| `in_progress` | Started; asset lifecycle usually `in_maintenance` |
| `completed` | Done; service history written |
| `cancelled` | Draft cancel **or** WF reject |

### Transition map (engine + service)

Enforced primarily by **`AssetMaintenanceEngine`** (status flips) and **`MaintenanceService`** (WF, asset lifecycle, history). Validator gates readiness (asset/assignment/transfer/ops).

```text
draft ──submit──► submitted ──approve──► approved ──schedule──► scheduled
                      │                      │                      │
                   reject*                start/complete         start/complete
                      ▼                      │                      │
                 cancelled                   ▼                      ▼
                      │                 in_progress ──────────► completed
                   reopen†                    ▲
                      │                       └── start from approved|scheduled
                      ▼
                    draft
                 (then resubmit = reopen-if-needed + submit)

draft ──cancel──► cancelled   (only if no workflow_instance_id)
```

\* Reject: service sets `cancelled` + `workflow_status=rejected` (not an engine method). Requires governance enabled.  
† Reopen: only `cancelled` **and** `workflow_status == rejected`. Plain draft-cancel cannot reopen via engine rules.

**Skips:** Engine allows **complete** from `approved`, `scheduled`, or `in_progress` (Start is optional). UI mirrors that.

**Resubmit:** If cancelled+rejected → reopen then submit; if already draft → submit.

### Where rules live (vs ops engine)

| Concern | Style |
|---------|--------|
| WO status transitions | Dedicated **engine** (`AssetMaintenanceEngine`) — same pattern as assignment/transfer engines |
| Business gates (asset lifecycle, open WO exclusivity, assignment, pending transfer, ops block, type/vendor/employee refs) | **`MaintenanceValidator`** |
| WF submit/approve/reject | **`AssetGovernanceService`** + flag `ASSET_WORKFLOW_GOVERNANCE_ENABLED` |
| Ops status matrix | **Not** used to *drive* maintenance lifecycle; only a **block set** (below) |

This is **not** scattered ad-hoc status strings in the router; routers are thin.

### Dual status model (critical)

There are **two** independent fields on the asset:

| Field | Role in Maintenance |
|-------|---------------------|
| `ast_asset.status` (**lifecycle**) | **Mutated** on Start / Complete |
| `ast_asset.operational_status` (**ops**) | **Not mutated**; used only as a **gate** |

#### `OPS_BLOCKED_FOR_MAINTENANCE_OR_TRANSFER`

File: `apps/api/src/modules/asset/domain/operational_status_rules.py`

```text
{ RETIRED, PENDING_DISPOSAL, DISPOSED, IN_USE_AS_COMPONENT }
```

Used by `MaintenanceValidator._validate_operational_allows_maintenance` on create / update / submit / approve / start.  
**There is no ops status named “IN_MAINTENANCE”.** Being “in maintenance” is expressed as lifecycle `status = in_maintenance` after **Start**.

**Note:** Error copy says “Retired, pending disposal, or disposed…” and **omits** `IN_USE_AS_COMPONENT` even though that value is in the set.

**FE mismatch:** `isOpsBlockedForTransferOrMaintenance` in `asset-status.ts` also blocks **`ASSIGNED`**. Backend block set does **not** include `ASSIGNED`; instead BE uses **open assignment** check. Inventory therefore hides Maintenance for assigned assets (UI), while BE would reject create if assignment still open.

#### Lifecycle changes on Start / Complete / Reopen

| Action | WO status | `ast_asset.status` (lifecycle) | `operational_status` |
|--------|-----------|--------------------------------|----------------------|
| Create draft | `draft` | **unchanged** | unchanged |
| Submit / Approve / Schedule / Reject / Cancel / Reopen | WO only (+ WF fields) | **unchanged** | unchanged |
| **Start** | → `in_progress` | → **`in_maintenance`** (if not already) | **unchanged** |
| **Complete** | → `completed` | → **`active`** if no other open WO and was `in_maintenance` | **unchanged** |
| Reopen | → `draft`, clear WF | **unchanged** | unchanged |

**Implication:** Until Start, a draft/submitted/approved WO does **not** flip the asset to `in_maintenance`. Assignment eligibility still keys off `READY_TO_MOVE` + lifecycle `active|in_maintenance` — open WOs are **not** checked in `assignment_validator` for exclusivity. Ops status can remain `READY_TO_MOVE` throughout an active maintenance lifecycle flip.

Open WO exclusivity (`find_open_for_asset`): statuses draft/submitted/approved/scheduled/in_progress — one open WO per asset.

Start also blocks if a **pending transfer** exists.

---

## 4. Create Draft form fields

### UI fields (`AssetMaintenanceWorkspace` Create draft)

| UI label | Payload field | Required (UI) | Required (API schema) | Notes |
|----------|---------------|---------------|------------------------|-------|
| Asset | `asset_id` | Yes | **Yes** | Select of active + in_maintenance assets (≤100 each) |
| Branch | `branch_id` | Yes (auto) | **Yes** | **Read-only UUID** copied from selected asset — not free-text edit, also **not** a named branch picker (`listBranchOptions` unused here) |
| Type | `maintenance_type` | Yes | **Yes** | Default `preventive` |
| Scheduled date | `scheduled_date` | No | No | `date` input |
| Cost | `cost_amount` | No | No | number |
| Technician employee UUID | `technician_employee_id` | No | No | **Raw text** UUID |
| Vendor UUID | `vendor_id` | No | No | **Raw text** UUID |

API also allows (not on create form UI):

| Field | Required | Notes |
|-------|----------|-------|
| `maintenance_plan_id` | No | Validated if present via plan validator |
| `quality_inspection_id` | No | Opaque UUID on model; not shown in UI |
| `company_id` | No | Resolved from tenant scope |

On create, service also enforces: branch must equal **asset’s current branch**.

### Type enum

DB + validator: `preventive` | `corrective` | `emergency` | `annual_service`.

Downstream: type is stored and used in service-history summary text on complete. **No** type-specific transition rules or required fields beyond enum membership (+ optional plan link rules).

### Technician / Vendor — pickers elsewhere

Confirmed raw UUID inputs today (labels explicitly say “UUID”).

Reusable employee resolution already in Assets:

- `listEmployeeOptions` / `listEmployeeDirectory` — `apps/web/src/lib/org-options.ts` (`GET /employees`)
- Assignment / Return wizards inject `listEmployees` into `EmployeeStep` select

Vendor:

- FK to `master.master_vendor`
- Procurement has `listVendorOptions` (`procurement-service.ts`) — not wired into Assets Maintenance today

### Reason / duration / expected return

| Concept | On `ast_asset_maintenance` today? |
|---------|-----------------------------------|
| Reason / remarks / description | **No** |
| Duration / expected return date | **No** |
| Closest existing date fields | `scheduled_date`, `completed_date` (completion set to **today** on complete) |

Workflow comments exist only as **approve/reject** request body (not persisted on the WO row as a first-class field).

---

## 5. History / timeline mechanics

| Mechanism | What it is | When written |
|-----------|------------|--------------|
| Foundation `AuditService.log_entity_change` | Generic entity audit (create/update/approve/cancel/reopen/schedule/start/complete) | Each service mutation |
| `ast_asset_service_history` | One **recorded** service event per completed WO (`maintenance_id`, `service_summary`, cost, `serviced_at`) | **Complete only** |
| Dedicated WO timeline / comments table | **Does not exist** | — |

“Work order detail” today shows: document number, asset name, status (+ workflow_status), type, scheduled/completed dates, truncated technician/vendor IDs, cost, action buttons, and draft edit fields. **No** chronological event list, **no** audit feed, **no** service-history embed.

A Components-style “View Detail” drawer with **full history** would need either:

- Aggregation of Foundation audit + related service-history rows for that `maintenance_id` / `asset_id`, or  
- New backend timeline API/table  

Current GET-by-id alone is **insufficient** for a rich history drawer without additional reads.

Service History has its own workspace (`/assets/service-histories`) listing completed events — parallel surface, not embedded in Maintenance detail.

---

## 6. Maintenance list — what it shows today

- Default load: **no status filter** → **all statuses** mixed (draft, scheduled, completed, cancelled, etc.), newest first (`created_at.desc`).
- Optional UI filters: status dropdown (all enum values), type, search `q` (document number / asset code via join), pagination.
- There is **no** default “active only” (open WO) view; user must manually filter (e.g. `in_progress` / `scheduled`).

Status meanings on the list: same as §3 (raw enum strings in a badge, optionally `status / workflow_status`).

---

## 7. Interaction with Components / `IN_USE_AS_COMPONENT`

| Question | Answer |
|----------|--------|
| Can an asset with ops `IN_USE_AS_COMPONENT` get a maintenance WO? | **No** — blocked by `OPS_BLOCKED_FOR_MAINTENANCE_OR_TRANSFER` on create/submit/approve/start |
| Does Maintenance change or clear component linkage? | **No** — no calls into component attach/detach |
| Does Start/Complete touch `IN_USE_AS_COMPONENT`? | **No** — only lifecycle `status` |
| Parent hosting linked components while Ready? | Allowed for maintenance if not in block set and no open assignment; **untested product territory** for “maintain parent with linked child assets” |
| Child currently InUse | Cannot open WO until detached (ops → Ready) |

FE inventory: Maintenance menu also hidden when `isOpsBlockedForTransferOrMaintenance` (includes InUse + Assigned + terminals).

---

## Related surfaces (non-goals of this report, for context)

- **Maintenance Plans** — separate CRUD/activate/pause/resume/close; can optionally link to a WO via `maintenance_plan_id`.
- **Non-IT** maintenance start/complete dialogs — different module/API; do not share this WO engine.
- **Checklists** — can reference a maintenance id in some validators; not the primary Maintenance UX.

---

## What must be decided before Part 2

Do **not** treat the following as implementation proposals — only decision prompts after review.

### A. Bug vs product intent for All Assets → Maintenance

1. Should “Maintenance” **only navigate + prefill**, or **auto-create a draft** (and open detail)?  
2. Confirm fixing dead `prefillAssetId` wiring is in scope for Part 2 regardless of (1).

### B. How much of the approval / lifecycle pipeline is load-bearing?

| Piece | Load-bearing elsewhere? | Collapse risk |
|-------|-------------------------|---------------|
| WF submit / approve / reject (`AST_MAINTENANCE_APPROVAL`) | Foundation WF instances, SoD (creator ≠ approver), permissions `submit`/`approve`, notifications | Hiding or auto-approving affects roles, audit, and any env with governance **on** |
| Schedule / Start / Complete | Start/Complete drive **lifecycle** `in_maintenance` ↔ `active`; reports/KPIs using `in_maintenance`; service history on complete | Skipping Start without replacing lifecycle rules leaves assets “active” while “in shop” |
| Draft / cancel / reopen / resubmit | Open-WO exclusivity; reject→reopen path | Simplifying cancel semantics is safer than deleting exclusivity |
| Maintenance Plans + Service History workspaces | Separate products; complete → service history | Removing complete→history breaks Service History feed |

**Decision needed:** Which transitions remain **real API states** vs which become **UI-hidden** defaults (e.g. auto-submit+approve+start on create) while keeping DB/WF compatible.

### C. Lifecycle vs operational status story

1. Keep “in maintenance” as **lifecycle only**, or introduce / map an **ops** signal (today none)?  
2. Should open WOs (even draft) **block assignment/transfer** the way Start’s lifecycle flip incompletely does today?  
3. Align FE `ASSIGNED` gate with BE (open-assignment vs ops block set).

### D. Create form field set

1. Which of type / cost / technician / vendor / scheduled_date remain first-class vs deferred?  
2. Are **reason** and **duration / expected return** new columns, remarks-only, or derived from dates?  
3. Branch display: keep auto UUID vs resolve via `listBranchOptions` (still not free-text).

### E. History / register UX

1. Full-width register + View Detail drawer: enough with existing GET + optional service-history-by-`maintenance_id` + audit query, or new timeline contract required?  
2. Should list default to **open** WOs only?

### F. Components / assigned assets

1. Confirm policy: InUse-as-component stays hard-blocked.  
2. Confirm policy: assigned assets must return before maintenance (current BE) vs allow maintenance while assigned (would require validator change).

### G. Governance flag

Confirm whether production runs with `ASSET_WORKFLOW_GOVERNANCE_ENABLED` true. Collapse designs differ sharply if approve/reject are mandatory vs legacy auto-approve path.

---

*End of Part 1 analysis. No schema, API, or UI changes were made in this pass.*
