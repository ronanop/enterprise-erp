# CR-004 — Import Engine Architecture

**Phase:** 8B  
**Date:** 2026-08-05

---

## Layers

| Layer | Responsibility |
|-------|----------------|
| UI (`excel-import/*`) | Parse, map, validate, preview (8A); confirm warnings; POST import |
| Router `POST /assets/assets/import` | Thin orchestration endpoint (not new CRUD) |
| `AssetExcelImportService` | Batching, savepoints, commit/rollback, summary |
| `AssetExcelImportEngine` | Single-row workflow orchestration |
| `AssetService` / `AssignmentService` / `AssetOperationalStatusService` | Business rules + audit |

---

## Data flow

```text
Excel File
  → Phase 8A Preview (valid | warning | invalid)
  → Validated Rows (+ resolved UUIDs)
  → Import Engine
  → Asset Service
  → Assignment Service
  → Operational Status Service (via workflows)
  → Audit (existing)
  → Import Summary
```

---

## Duplicate handling

Before create:

1. `AssetService.find_by_asset_code` (Asset Tag)  
2. `AssetService.find_by_serial_number` (when serial present)

**Policy:** skip duplicate · log reason · continue · **never overwrite**

`DuplicateAssetRegistrationError` from create path also maps to duplicate outcome.

---

## Operational status paths

Matrix forbids READY → RETIRED / READY → DISPOSED. Import therefore:

| Target | Path |
|--------|------|
| READY_TO_MOVE | create → submit → approve |
| ASSIGNED | + employee assignment activate |
| RETIRED | + assign (employee or branch) → return `outdated` |
| PENDING_DISPOSAL | + assign → return `dead` |
| DISPOSED | pending path → `apply_action("complete_disposal")` |

No manual `operational_status` column writes from the engine.

---

## Batch / transaction

```text
for each batch (default 50):
  for each row:
    SAVEPOINT
      import_row via engine
    COMMIT SAVEPOINT | ROLLBACK SAVEPOINT
  COMMIT batch
  on commit error → ROLLBACK batch only
```

---

## Configuration

- Column headers remain configurable via Phase 8A mapping + aliases  
- Import defaults: `asset_category_id`, `asset_type`, `purchase_cost`, `currency_code`, optional `purchase_date`  
- External Asset Tag via `AssetService.create_for_import` (additive; normal `create` still strips client codes)

---

## Explicit non-goals

- New Asset register CRUD APIs  
- Repository/ORM bypass  
- Business-rule duplication  
- Parallel run / dashboard / reports / sidebar  
