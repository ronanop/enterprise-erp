# CR-004 Phase 3.1 — IT Admin Experience (UI/UX Design Freeze)

**Status:** LOCKED — design freeze (documentation only)  
**Date:** 2026-08-03  
**Audience:** IT Administrators (daily operational workspace)  
**Design baseline:** Enterprise ERP Platform — Data-Dense Dashboard + Swiss Minimalism (`design-system/enterprise-erp-platform/MASTER.md`)

---

## Scope

| In scope | Out of scope (Phase 3.1) |
|----------|---------------------------|
| Dashboard landing redesign spec | React / TypeScript / CSS implementation |
| Locked sidebar IA | Backend or route changes |
| Inventory views as filtered register | New APIs (document gaps only) |
| Table column matrix | Transition POST endpoints (future) |
| User journeys | Generic ERP funnel as primary landing |

---

## Design principles

1. **Operational first** — KPIs and queues reflect `operational_status` (CR-004), not registration lifecycle alone.
2. **Single register** — All inventory views are `GET /assets` with filters; no duplicate modules.
3. **Derived data read-only** — Current Holder, employee name, configuration come from composition (portal/report pattern), not editable grid cells.
4. **Branch-scoped daily use** — Header + branch filter default to user context; company/tenant scope unchanged from platform.
5. **Density 9/10** — Compact KPI row, two-column queues, table-first inventory on desktop.

---

## Document map

| Document | Contents |
|----------|----------|
| [CR-004-Dashboard-Wireframe.md](./CR-004-Dashboard-Wireframe.md) | Landing layout, widgets, responsive |
| [CR-004-Sidebar-Design.md](./CR-004-Sidebar-Design.md) | Locked nav tree + routes |
| [CR-004-Inventory-Views.md](./CR-004-Inventory-Views.md) | Filtered register views |
| [CR-004-Frontend-Implementation-Plan.md](./CR-004-Frontend-Implementation-Plan.md) | Phases 3.2–3.5 |
| This file | Summary + API mapping + journeys index |

---

## Task 1 — Dashboard (summary)

See wireframe doc. Landing route remains **`/assets`** (replaces generic workspace cards as primary content).

---

## Task 2 — Sidebar (summary)

Locked structure matches product interview + existing `assetManagementNav` intent. Labels normalized: **Assignment** (not “Asset Assignment”) in Operations group for freeze; implementation may alias existing hrefs.

---

## Task 3 — Inventory views (summary)

Six views → one list component, query param `operational_status` (+ optional `branch_id`).

---

## Task 4 — Table columns (summary)

Full matrix in [CR-004-Inventory-Views.md](./CR-004-Inventory-Views.md#asset-register-column-matrix).

---

## Task 5 — Quick actions (freeze)

| Action | Entry points | Target | Implement phase |
|--------|--------------|--------|-----------------|
| Register Asset | Dashboard, sidebar Add Asset | `/assets/assets/new` | 3.2 / 3.5 |
| Assign Asset | Dashboard, Operations | Assignment create | 3.5 |
| Return Asset | Dashboard, Assignment list | Return dialog on active row | 3.5 |
| Discovery | Dashboard, asset detail | Discovery panel (CR-003) | 3.5 |
| View Portal | Row actions, asset detail | Information portal route | 3.5 |
| QR | Toolbar, sidebar QR workspace | `/assets/qr-barcode` | 3.5 |

No new buttons beyond permission matrix; destructive actions stay in lifecycle modules.

---

## Task 6 — Responsive (summary)

Documented in wireframe: desktop 3-column KPI + 2-col queues; tablet stacked KPI; mobile single column + bottom sheet branch filter.

---

## Task 7 — User journeys (detail)

### New employee

1. Dashboard → Ready To Move KPI or queue.  
2. **Assign Asset** → select asset → assignment wizard (employee).  
3. Approve/activate per governance → ops `ASSIGNED`.  
4. Confirm Current Holder via portal / expanded row.

### Laptop return

1. Assignment list or **Return Asset** quick action.  
2. Return condition: Good → `READY_TO_MOVE`; Outdated → `RETIRED`; Dead → `PENDING_DISPOSAL`.  
3. Assignment returned; ops updated by service only.

### Ready to move

KPI or queue → filtered inventory → assign or transfer.

### Pending disposal

Pending queue → disposal document → post → ops `DISPOSED`.

### Asset search

All Assets + `q` (tag, name, serial) + optional filters.

### Branch inventory

Branch filter → `dashboard-summary?branch_id=` + lists with same `branch_id`.

---

## Task 8 — Dashboard API mapping

| UI widget | API | Status |
|-----------|-----|--------|
| KPI — Total Assets | `GET /api/v1/assets/assets/dashboard-summary` → `total_assets` | **Exists** (CR-004 2C) |
| KPI — Ready To Move | same → `ready_to_move` | **Exists** |
| KPI — Assigned | same → `assigned` | **Exists** |
| KPI — Retired | same → `retired` | **Exists** |
| KPI — Pending Disposal | same → `pending_disposal` | **Exists** |
| KPI — Disposed | same → `disposed` | **Exists** |
| Branch filter (counts) | `dashboard-summary?branch_id=` + `by_branch[]` at company scope | **Exists** |
| Branch filter (labels) | Organization branches API (platform) | **Exists** (reuse org module) |
| Ready To Move queue | `GET /api/v1/assets/assets?operational_status=READY_TO_MOVE&limit=n` | **Exists** |
| Pending Disposal queue | `GET ...?operational_status=PENDING_DISPOSAL&limit=n` | **Exists** |
| Recent Assignments | `GET /api/v1/assets/asset-assignments?status=active` (+ sort/limit client-side) | **Exists** (no dedicated “recent” endpoint) |
| Recent Returns | `GET /api/v1/assets/asset-assignments?status=returned` | **Exists** |
| Recent Registrations | `GET /api/v1/assets/assets?status=active` or `draft` + sort by `created_at` | **Exists** (sort not explicit in API — **gap:** document client sort on `created_at` from response or add `sort` later; **3.1 does not add backend**) |
| Header — user | Session / `TenantContext` / profile API | **Exists** (platform) |
| Header — branch | Session `branch_id` + org branch name | **Exists** |
| Quick — Register | Navigate `/assets/assets/new` + `POST /assets/assets` | **Exists** |
| Quick — Assign | Navigate assignment create | **Exists** |
| Quick — Return | Assignment list / detail return | **Exists** (`POST .../return`; `return_condition` body **gap** — not on OpenAPI yet; UI design assumes query/body in 3.5) |
| Quick — Discovery | Per-asset discovery routes | **Exists** (CR-003) |
| Register table — derived columns | Per-row portal composition | **Gap for list:** no bulk IT register DTO; **Phase 3.4+** uses staged loading (list core fields + expand portal) or report composer (future) |

**Do not use** `GET /assets/asset-reports/dashboard` for ops KPIs (finance/executive report — different product).

---

## Task 9 — Implementation plan

See [CR-004-Frontend-Implementation-Plan.md](./CR-004-Frontend-Implementation-Plan.md).

---

## Approval

| Role | Phase 3.1 |
|------|-----------|
| Product / IT Admin stakeholder | Pending sign-off |
| Engineering | Blocked until 3.2 kickoff |

**Next:** Phase 3.2 — Dashboard implementation (frontend only).
