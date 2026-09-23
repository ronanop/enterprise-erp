# CR-004 Phase 7A — Excel Export Foundation

**Date:** 2026-08-05  
**Scope:** Inventory register export (Excel + CSV) only  
**Out of scope:** Import, reports module, dashboard, sidebar, workflows, ops status, assignment changes, new APIs

---

## Objective

IT Admins can download the **same Asset Register** shown in Inventory, respecting current filters, as `.xlsx` or `.csv`.

---

## Architecture

```text
Inventory Workspace (Export dropdown — presentational)
        ↓
Inventory Container (loading / success / error; applies current filters)
        ↓
inventory-export-service.ts
        ↓
Existing inventory mapper + register-parity fields
        ↓
CSV / XLSX helpers (SheetJS `xlsx`)
```

No export logic inside UI components beyond invoking callbacks.

---

## Supported formats

| Format | Extension | Library |
|--------|-----------|---------|
| Excel | `.xlsx` | `xlsx` (existing dependency) |
| CSV | `.csv` | UTF-8 BOM + CRLF |

Filename pattern: `asset-inventory-register-YYYY-MM-DD.{xlsx|csv}`

---

## Data source & filters

Reuses **only** existing read APIs:

- `assetOperationsService.listAssets` (same query builder as inventory)
- `assetOperationsService.listAssignments` (enrichment / Earlier Used By / remarks)

**Server filters:** branch, operational status (preset), search `q`, lifecycle status, category  

**Client filters (same as inventory mapper):** department, asset type, location  

**Pagination:** UI page size does **not** limit export. Client loops pages at **`page_size = 200`** (asset module `get_pagination` max `le=200`). Documented — **no new backend endpoint**.

---

## Export columns (ordered)

Asset Tag · Laptop Name · Manufacturer · Model · Configuration · Current Holder · Employee ID · Department · Branch · Operational Status · Lifecycle Status · Issue Date · Earlier Used By · Delivery Reference · Delivery Status · Assignment Remarks · Return Remarks · Location  

Mapped from `InventoryRowViewModel` / expandable register-parity fields only.

---

## UI

Inventory toolbar **Export** dropdown:

- Export Excel  
- Export CSV  
- Loading: “Exporting…”  
- Success / failure messages under control  

---

## Files

| Path | Role |
|------|------|
| `inventory/export/inventory-export.types.ts` | Formats, columns, errors |
| `inventory/export/inventory-export.mapper.ts` | Row → export record |
| `inventory/export/inventory-export.helpers.ts` | CSV/XLSX/download |
| `inventory/export/inventory-export-service.ts` | Fetch-all + export |
| `inventory/export/inventory-export-toolbar.tsx` | Presentational control |
| `inventory/export/inventory-export.test.tsx` | 50+ tests |

---

## Tests

`inventory-export.test.tsx` covers mapping, CSV, Excel, column order, empty export, filtered export, filename, errors, loading toolbar, pagination beyond UI page size.

---

## Risks

| Risk | Notes |
|------|--------|
| Large tenants | Many 200-row pages; may be slow; no streaming API yet |
| Assignment history page loop | Same 200 cap; incomplete history if >200×N pages truncated by safety stop |
| Client-only filters | Export applies department/type/location on full fetched set (more accurate than current paged UI) |

---

## Validation

- [x] Excel + CSV  
- [x] Same inventory filters  
- [x] All matching rows (not UI page)  
- [x] No new APIs  
- [x] No import / workflow / DB changes  
- [x] 50+ tests green  
