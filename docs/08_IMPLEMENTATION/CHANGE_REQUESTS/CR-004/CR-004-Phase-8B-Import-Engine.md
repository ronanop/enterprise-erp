# CR-004 Phase 8B — Excel Import Engine

**Date:** 2026-08-05  
**Scope:** Import **validated** Phase 8A preview rows into ERP via existing business services  
**Explicitly excluded:** New asset CRUD APIs, direct repository/ORM writes, ops-status shortcuts, dashboard, reports, sidebar, parallel run

---

## Objective

Commit Excel register rows that passed preview validation, preserving CR-004 business rules by reusing:

- `AssetService` (create_for_import → submit → approve)
- `AssignmentService` (create → submit → approve → return when required)
- `AssetOperationalStatusService` (via those workflows; `apply_action("complete_disposal")` only after pending path)

---

## Architecture

```text
Preview rows (Phase 8A)
        ↓
POST /assets/assets/import
        ↓
AssetExcelImportService (batches + txn)
        ↓
AssetExcelImportEngine (per row)
        ↓
AssetService / AssignmentService / AssetOperationalStatusService
        ↓
Existing audit (no custom audit)
        ↓
Import summary
```

Details: `CR-004-Import-Engine-Architecture.md`

---

## Import rules

| Preview status | Behaviour |
|----------------|-----------|
| `valid` | Import |
| `error` / `invalid` | Skip (never import) |
| `warning` | Import only if `confirm_warnings=true` |

---

## Per-row workflow

1. Duplicate check (asset tag, serial) → skip duplicate, continue  
2. `create_for_import` (external Asset Tag as `asset_code`; system `document_number`)  
3. `submit` → `approve` → READY_TO_MOVE (existing initialize)  
4. If employee / target status requires: assignment create → submit → approve  
5. RETIRED / PENDING / DISPOSED: assignment return (outdated/dead) then optional `complete_disposal`  
6. Audit via existing services  

---

## Batch strategy

- Default batch size **50** (configurable, max 500)  
- Savepoint per row; commit per batch  
- Batch failure → rollback **that batch only**  
- One row failure does not stop the import  

---

## Frontend

- Route `/assets/inventory-import` Import button enabled after default category selected  
- Warning rows require explicit checkbox  
- Payload built from preview + master lookups (configurable mapping / aliases from 8A)

---

## Tests

Backend unit suites under `tests/unit/asset/test_excel_import_*` + `test_asset_excel_import_service.py`  
Frontend: `excel-import-api-mapper.test.ts` + updated `excel-import.test.tsx`  

Target: **80+** cases across engine, batching, duplicates, rollback, assignment/ops paths, summary, architecture guards, FE payload mapping.

---

## Validation checklist

- [x] Import only VALID (and confirmed WARNING)  
- [x] No direct repository writes from engine  
- [x] Duplicate skip (tag + serial)  
- [x] Batch commit / rollback  
- [x] Summary counters  
- [x] Reuse Asset / Assignment / Operational Status services  
- [x] Configurable mapping retained (8A)  
