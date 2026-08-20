# CR-005 Phase 3 — Dashboard Operations Panel

**Status:** Complete  
**Date:** 2026-08-06  
**Mode:** Frontend only — reuse existing routes, APIs, containers

---

## Mission

Complete the Asset Operations Workspace so daily IT ops (register, allocate, return, import, export) run from `/assets` without sidebar hopping. Unified branch drives KPIs, register, drawer scope, and recent activity.

---

## Dashboard operations architecture

```text
/assets
  └─ AssetOperationsContainer  (single branchId SSOT)
       ├─ fetchAssetOperationsData(branchId)
       │    → summary + lists (assets / assignments / transfers)
       └─ AssetOperationsDashboard
            ├─ Header (title + BranchSelector + Refresh)
            ├─ KPI StatCards
            ├─ OperationsQuickActions → existing routes / export
            ├─ register → AssetInventoryContainer (embedded, same branchId)
            │              └─ AssetInventoryWorkspace (Asset Register section)
            │                   └─ AssetDetailDrawer
            └─ OperationsRecentActivity (max 10)
```

---

## Quick Actions

| Card | Behavior |
|------|----------|
| Add Asset | `navigation.openRegisterNew()` → `/assets/assets/new` |
| Allocate Asset | `openAssignmentWizard()` → `/assets/asset-assignments/new` |
| Return Asset | `openReturnWizard()` → return wizard |
| Bulk Import | `openInventoryImport()` → `/assets/inventory-import` |
| Export Register | Invokes inventory `exportInventoryRegister` (xlsx) via registered handler |

No new forms or business logic.

---

## Recent Activity

Built by `mapOperationsPayloadToRecentActivity` from existing list APIs:

| Event | Source |
|-------|--------|
| Asset Registered | `listAssets` (recent page) |
| Asset Assigned / Returned | `listAssignments` |
| Asset Disposed | disposal queue assets |
| Asset Transfer | `GET /assets/asset-transfers` (existing resource list) |

Columns: Event, Asset, Employee, Date, Status. Cap: **10**.

---

## Unified branch state

- Single `branchId` in `AssetOperationsContainer`
- Passed to dashboard KPIs/activity fetch and to `AssetInventoryContainer` as controlled `branchId` / `onBranchChange`
- Embedded register hides local BranchSelector (`hideBranchSelector`)
- Changing branch refreshes KPIs, activity, inventory (and drawer data on next open)

---

## Register chrome

- Title: **Asset Register** (was “IT Asset Inventory”)
- Embedded mode: section header under dashboard (no second page title)
- Filters, presets, search, pagination, export toolbar, drawer unchanged

---

## Components reused

`AssetOperationsContainer`, `AssetOperationsDashboard`, `AssetInventoryContainer`, `AssetInventoryWorkspace`, `AssetDetailDrawer`, `QuickActionCard`, `StatCard`, `BranchSelector`, `InventoryFilterBar`, export pipeline, assignment/return wizards (via routes), `useAssetNavigation`, existing list/summary APIs

---

## Tests

| Suite | Focus |
|-------|--------|
| `asset-operations-dashboard.test.tsx` | KPIs, quick actions, activity, register slot |
| `asset-operations-container.test.tsx` | Unified branch, nav, export, activity mapping |
| `asset-operations-fetch.test.ts` | Parallel fetches + branch param |
| `dashboard.mapper.test.ts` | Recent activity mapping |
| Workspace / inventory / navigation | Register rename, embedded mode, new nav helpers |

**74** tests passed in Phase 3 core suites (≥ 40 target).

---

## Risks

| Risk | Mitigation |
|------|------------|
| Transfer list shape varies | Normalize `items` array; empty on failure |
| Export quick action no-ops if inventory not mounted | Handler registered from embedded container |
| Filter-bar branch vs header branch | Header branch unified; filter bar branch field still local filter (apply still works) |
| Activity date sort uses formatted strings | Acceptable for Phase 3; ISO sort can tighten later |

---

## Validation

| Check | Result |
|-------|--------|
| Quick actions navigate existing routes | Pass |
| Export uses existing export workflow | Pass |
| Unified branch updates KPIs + inventory | Pass |
| Register renamed / no duplicate page header when embedded | Pass |
| Recent activity ≤ 10 from existing APIs | Pass |
| No backend / new API / duplicate pages | Pass |
