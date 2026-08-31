# CR-004 Phase 8A — Excel Import Foundation (Preview & Validation)

**Date:** 2026-08-05  
**Scope:** Safe, **read-only** upload → parse → map → validate → preview  
**Explicitly excluded:** Database writes, asset/assignment creation, ops status updates, batch commit, rollback, reports

---

## Objective

IT Admins can upload a customer Excel/CSV register, validate it against ERP master data, and preview row-level errors **before** any import execution (Phase 8B).

---

## Architecture

```text
/assets/inventory-import (page)
        ↓
ExcelImportContainer (master lookups + step state)
        ↓
excel-import-service (parse workbook / CSV)
        ↓
excel-import-mapper (column mapping + normalization)
        ↓
excel-import-validator (template + row rules)
        ↓
Preview grid + validation summary
```

Master data lookups only (existing APIs):

- `/branches`, `/departments`, `/employees`
- asset categories search

**No import POST. No DB writes.**

---

## Flow (stops at preview)

1. Select file (`.xlsx` / `.xls` / `.csv`)  
2. Parse workbook (first sheet)  
3. Validate template (required columns suggested)  
4. Review / adjust column mapping  
5. Validate rows  
6. Preview (valid / warning / invalid)  
7. **STOP** — Import button disabled  

---

## Validation rules

| Rule | Severity |
|------|----------|
| Unsupported file type | Fatal |
| Missing required mapped columns (Asset Tag, Laptop Name, Branch, Operational Status) | Error |
| Empty workbook / over hard max rows (10k) | Error |
| Large file &gt; 2000 rows | Warning |
| Duplicate Asset Tag within file | Error |
| Empty mandatory cell | Error |
| Invalid operational status (enum + Excel aliases) | Error |
| Unknown branch / department / category / employee | Error |
| Invalid issue date | Error |
| Invalid delivery status | Error |
| ASSIGNED without Employee ID | Warning |

---

## Column mapping

Targets reuse CR-004 register ownership (`EXCEL_IMPORT_TARGET_FIELDS`), with aliases for common Excel headers. Auto-suggest on parse; user can remap before validation.

---

## Route

`/assets/inventory-import`

---

## Tests

`excel-import.test.tsx` — **62** tests (parse, template, mapping, duplicates, invalid masters, dates, delivery, preview UI, disabled import, regression purity).

---

## Risks

| Risk | Mitigation |
|------|------------|
| Ambiguous DD/MM vs MM/DD dates | Prefer ISO; DD/MM when day &gt; 12 |
| Employee match by loose label | Prefer EMP code in parentheses |
| First sheet only | Documented; multi-sheet later |
| Master lists page-capped (200) | Same as inventory export; document |

---

## Validation checklist

- [x] Accept xlsx/xls/csv only  
- [x] Preview without writes  
- [x] Row-level messages  
- [x] Column mapping UI  
- [x] Import action disabled  
- [x] 60+ tests  
