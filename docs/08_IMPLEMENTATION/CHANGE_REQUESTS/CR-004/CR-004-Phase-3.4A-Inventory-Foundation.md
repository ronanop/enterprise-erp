# CR-004 Phase 3.4A — Inventory Foundation

**Status:** Complete  
**Date:** 2026-08-03  
**Route:** `/assets/assets` (single register — filter-driven)

---

## Architecture

```text
AssetInventoryContainer
        ↓
inventory.mapper.ts
        ↓
AssetInventoryWorkspace (presentational)
```

Reuses `InventoryFilterBar`, `BranchSelector`, `StatusBadge`, `EmptyState`, `TableRowsSkeleton`.

---

## Preset views (tabs)

| Preset | `operational_status` |
|--------|----------------------|
| All Assets | (none) |
| Ready To Move | `READY_TO_MOVE` |
| Assigned | `ASSIGNED` |
| Retired | `RETIRED` |
| Pending Disposal | `PENDING_DISPOSAL` |
| Disposed | `DISPOSED` |

Presets sync the operational filter; no extra routes.

---

## API

`GET /api/v1/assets/assets` with `operational_status`, `branch_id`, `status`, `asset_category_id`, `q`, `page`, `page_size`.

Assignments fetched in parallel (`page_size=500`) for holder / issue date derivation only.

Department, asset type, and location filters apply client-side on the current result set (API has no department/type/location query params).

---

## Columns

Default visible grid per CR-004 matrix; expandable row for Earlier Used By, Delivery Challan, Phone, Remarks (placeholders until 3.4B+ data).

Row action: **View** only → `/assets/assets/{id}`.

---

## Responsive

| Breakpoint | Layout |
|------------|--------|
| `md+` | Full table |
| `<md` | Card list |

---

## Out of scope (3.4A)

Assign, Return, Discovery, QR, Portal actions; sidebar; reports; new backend.

---

## Tests

`npm run test` in `apps/web` — mapper, container, workspace suites.
