# CR-005 Phase 1 — Dashboard Workspace Foundation

**Status:** Complete  
**Date:** 2026-08-06  
**Mode:** Layout foundation only (frontend)

---

## Mission

Convert the Asset Operations Dashboard into an **Asset Operations Workspace** that shows KPIs above the existing Asset Register.

No drawer, assignment, return, timeline, quick-action, sidebar, or navigation redesign in this phase.

---

## Architecture

```text
/assets (page.tsx)
  └─ AssetOperationsContainer
       ├─ fetchAssetOperationsData(branchId)  → dashboard-summary KPIs
       └─ AssetOperationsDashboard
            ├─ Header (title, subtitle, BranchSelector, Refresh)
            ├─ KPI StatCards (6)
            └─ register slot → AssetInventoryContainer
                 └─ AssetInventoryWorkspace (unchanged)
```

| Layer | Component | Role |
|-------|-----------|------|
| Page | `apps/web/src/app/(app)/assets/page.tsx` | Hosts workspace container |
| Container | `AssetOperationsContainer` | Branch + KPI load + embeds inventory |
| Presentational | `AssetOperationsDashboard` | Header, KPIs, register slot |
| Register | `AssetInventoryContainer` | Existing inventory data/UI (reused) |
| Presentational | `AssetInventoryWorkspace` | Filters, table, drawer (unchanged) |

---

## Layout changes

### Header

| Element | Value |
|---------|-------|
| Title | Asset Operations |
| Subtitle | Manage all company assets from one workspace. |
| Right | Branch Selector + Refresh |

Removed: notification / profile placeholders, Quick Actions grid, Operations QueueCards.

### Section 1 — KPI cards

Order (CR-005):

1. Total Assets  
2. Ready To Move  
3. Assigned  
4. Pending Disposal  
5. Retired  
6. Disposed  

Source: existing `getDashboardSummary` via `fetchAssetOperationsData` + `mapDashboardPayloadToViewModel` / `StatCard`. **API unchanged.**

### Section 2 — Main workspace

Embeds **existing** `AssetInventoryContainer` (table, `InventoryFilterBar`, presets, pagination, drawer, export). No new table.

### Responsive

| Breakpoint | Behavior |
|------------|----------|
| Desktop (`xl`) | 6 KPI columns; inventory fills below |
| Tablet (`md`) | 3 KPI columns; inventory stacked |
| Mobile | KPI + inventory stacked vertically |

---

## Components reused (not duplicated)

- `AssetOperationsContainer`
- `AssetOperationsDashboard`
- `fetchAssetOperationsData` / dashboard summary API client
- `dashboard.mapper` (KPI mapping)
- `AssetInventoryContainer` / `AssetInventoryWorkspace`
- `InventoryFilterBar`, `StatCard`, `BranchSelector`
- Existing inventory hooks, services, drawer, export

**Not created:** new pages, new APIs, new inventory containers/tables.

---

## Explicit non-goals (Phase 1)

- Drawer changes  
- Timeline  
- Quick Actions  
- Sidebar / navigation changes  
- Assignment / Return / Import / Export feature changes  
- Backend changes  

---

## Tests

| File | Coverage |
|------|----------|
| `asset-operations-dashboard.test.tsx` | Title/subtitle, branch, refresh, KPI order, register slot, no queues/quick actions |
| `asset-operations-container.test.tsx` | KPI load, inventory embed, refresh/retry, branch refetch, no legacy queues |
| `asset-inventory-*.test.tsx` | Unchanged — register behavior preserved |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Dual headers (workspace + inventory PageHeader) | Accepted for Phase 1; inventory chrome left intact to avoid redesign |
| Independent branch filters (header KPI vs inventory) | Phase 1 layout only; sync deferred |
| `fetchAssetOperationsData` still loads queue lists unused by UI | Reuses existing fetch; display removed only — slim fetch optional later |
| `/assets/assets` still hosts standalone inventory | No duplicate page created; route retained for navigation SSOT |

---

## Validation

| Check | Result |
|-------|--------|
| Dashboard renders | Pass |
| KPIs render from summary API | Pass |
| Inventory embedded below KPIs | Pass |
| Inventory filters / table / pagination unchanged | Pass (existing inventory tests) |
| No backend changes | Pass |
| No new inventory table / API / page | Pass |
