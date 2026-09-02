# CR-004 — Migration Reconciliation

**Phase:** 8C — Migration Validation & Reconciliation  
**Date:** 2026-08-05  
**Mode:** Analysis / validation only — **no code, no UI, no business-logic changes**  
**Sources:** Phase 8A preview contract, Phase 8A.5 customer Excel validation, Phase 8B import engine, Excel Migration Plan, register parity, inventory/dashboard APIs

---

## 0. Measurement basis

| Input | Status |
|-------|--------|
| Frozen customer `.xlsx` in repo | **Not present** (same as 8A.5) |
| Production / staging import run with signed counts | **Not executed** for this phase |
| Engine + preview capability vs locked Excel contract | **Analyzed** |
| Automated unit coverage of import paths | **Verified** (Phase 8B suites green) |

**Interpretation:** Counts below are **reconciliation templates**. Cells marked **N/A** mean *not measurable until a frozen workbook is imported into a quarantine tenant/branch and compared*. Design findings are **PASS / PARTIAL / FAIL / N/A**.

---

## 1. Asset count reconciliation

| Metric | Excel (expected) | ERP / Import summary | Delta | Status |
|--------|------------------|----------------------|-------|--------|
| Total source rows | N/A — no frozen file | N/A | — | **N/A** |
| Preview VALID | N/A | N/A | — | **N/A** |
| Preview WARNING | N/A | N/A | — | **N/A** |
| Preview ERROR / INVALID | N/A | Must not import | — | **PASS** (rule) |
| Imported | N/A | `summary.imported` | — | **N/A** |
| Skipped | N/A | `summary.skipped` | — | **N/A** |
| Failed | N/A | `summary.failed` | — | **N/A** |
| Duplicates | N/A | `summary.duplicates` | — | **N/A** |

### Design checks (asset identity)

| Check | Result | Notes |
|-------|--------|-------|
| Asset Tag → `asset_code` via `create_for_import` | **PASS** | External tag preserved; `document_number` system-assigned |
| Duplicate Asset Tag → skip, no overwrite | **PASS** | Engine + validator |
| Duplicate Serial → skip when serial present | **PASS** | Serial optional on FE mapping (8B added) |
| First-sheet-only vs multi-tab Excel buckets | **FAIL** (cutover) | 8A.5 M-1 still open — mass under-count risk |
| Title / merged header rows | **FAIL** (cutover) | 8A.5 M-2 still open |

---

## 2. Operational status reconciliation

| Ops status | Excel concept | Engine path | Excel vs ERP design match | Live count match |
|------------|---------------|-------------|---------------------------|------------------|
| READY_TO_MOVE | Ready To Move | create → submit → approve → initialize | **PASS** | N/A |
| ASSIGNED | Assigned | + employee assignment activate | **PASS** if employee present | N/A |
| RETIRED | Not Given To Anyone | assign → return `outdated` | **PARTIAL** | N/A |
| PENDING_DISPOSAL | Not Working | assign → return `dead` | **PARTIAL** | N/A |
| DISPOSED | Disposed | pending path → `complete_disposal` | **PARTIAL** | N/A |

### Differences / warnings

| ID | Difference | Severity |
|----|------------|----------|
| R-OPS-1 | Matrix blocks READY→RETIRED; import synthesizes assignment (employee or **branch**) then return | Medium — ERP history shows a transit assignment Excel never had |
| R-OPS-2 | DISPOSED may lack full Disposal document workflow; uses ops `apply_action` after pending | Medium — audit/disposal register may not match day-to-day dispose UI |
| R-OPS-3 | Status implied **only by sheet/tab name** is not imported correctly without Status column or multi-tab strategy | **Critical** — 8A.5 M-1 |
| R-OPS-4 | ASSIGNED without Employee ID is preview **Warning** (Migration Plan = **Error**); import only if `confirm_warnings` | High — policy mismatch |

---

## 3. Assignment field reconciliation

| Field | Excel | ERP after 8B import | Match |
|-------|-------|---------------------|-------|
| Employee | Employee ID | `assignment.employee_id` when ASSIGNED / holder path | **PASS** (if resolved) |
| Issue Date | Issue Date | Used as **`purchase_date` fallback**, not `allocated_at` | **FAIL** vs Migration Plan intent |
| Delivery Reference | Delivery Challan | `delivery_reference_number` on assignment | **PASS** |
| Delivery Status | Rare in Excel | Optional if mapped | **PARTIAL** |
| Assignment Remarks | Remarks | `assignment_remarks` | **PASS** |
| Return Remarks | Return remarks column | **Not mapped** on import; engine uses synthetic remarks on status-path returns | **FAIL** for historical return notes |
| Allocated At | Issue Date | Set to **activation timestamp** (`utcnow`) on approve | **FAIL** vs Excel issue date |

### Missing / unexpected

| Type | Detail |
|------|--------|
| Missing | Historical multi-assignment chains (Earlier Used By as free text correctly **not** imported) |
| Unexpected | Synthetic branch assignments for RETIRED/PENDING without employee |
| Unexpected | Purchase cost default `0`, default category when Excel has none |

---

## 4. Current Holder

| Check | Result |
|-------|--------|
| Must not import as writable Excel column | **PASS** (8A correctly skips) |
| Derived when `ASSIGNED` + active employee assignment | **PASS** (inventory mapper / register parity) |
| Live Excel vs ERP holder sample (50 rows) | **N/A** — no measured import |

**Warning:** If ASSIGNED imported with wrong employee lookup, holder will disagree with Excel without failing duplicate checks.

---

## 5. Earlier Used By

| Check | Result |
|-------|--------|
| Must not import Excel “Earlier Used By” as SSOT | **PASS** |
| Derived from returned assignment history in inventory UI | **PASS** (Phase 6 register-parity derivation) |
| After import of RETIRED via synthetic assign+return | **PARTIAL** — history may show branch/employee transit assignee, not Excel’s earlier holder text |
| Multi-holder Excel history without assignment log | **FAIL** to reconstruct — Migration Plan discourages inferring from Excel column |

---

## 6. Branch distribution

| Check | Result |
|-------|--------|
| Branch required on preview; resolved to `branch_id` | **PASS** (design) |
| Engine creates asset on mapped branch | **PASS** |
| Dashboard / inventory branch KPI vs Excel pivot | **N/A** measured |
| Label drift (e.g. “Noida HO” vs “Noida”) | **WARNING** — false invalid_branch or wrong bucket |

---

## 7. Department distribution

| Check | Result |
|-------|--------|
| Optional department map → `department_id` on create | **PASS** (when present & resolvable) |
| Excel often omits department | **PARTIAL** — ERP totals under-populated vs informal Excel |
| Live department pivot match | **N/A** |

---

## 8. Asset categories

| Check | Result |
|-------|--------|
| Optional Excel category → `asset_category_id` | **PASS** when mapped |
| Default category required at import UI | **PASS** (process control) |
| Risk: all uncategorized Excel rows collapse to one default category | **WARNING** — category distribution ≠ Excel reality |

---

## 9. Import summary vs inventory / dashboard

| Check | Design | Live |
|-------|--------|------|
| Import summary counters (imported/skipped/duplicates/warnings/failed/duration/batches) | **PASS** | N/A |
| Inventory total for quarantine branch = imported − disposed filter policy | Expected after dry-run | **N/A** |
| Dashboard ops KPIs = inventory ops counts | Same read model (dashboard-summary) | **N/A** |
| No duplicate `asset_code` post-import | Enforced by skip + unique registration checks | **N/A** measured |

---

## 10. Difference register (summary)

### Critical

| ID | Item |
|----|------|
| D-1 | No frozen workbook / measured Excel↔ERP counts |
| D-2 | Multi-tab / tab-implied status unsupported (M-1) |
| D-3 | Title/merged header hygiene unsupported (M-2) |

### High

| ID | Item |
|----|------|
| D-4 | Issue Date ≠ `allocated_at` |
| D-5 | ASSIGNED-without-employee severity mismatch |
| D-6 | Accessories (charger/other items) not imported |
| D-7 | Manufacturer / Model / Configuration not persisted on create path |

### Medium

| ID | Item |
|----|------|
| D-8 | Synthetic assignments for RETIRED/PENDING/DISPOSED |
| D-9 | Return Remarks not imported |
| D-10 | Default category / cost distortion |
| D-11 | DISPOSED without full disposal document parity |

### Low / accepted

| ID | Item |
|----|------|
| D-12 | Earlier Used By / Current Holder not imported (correct) |
| D-13 | Phone / employee name not on asset (correct) |

---

## 11. Reconciliation procedure (when frozen file available)

```text
1. Export Excel values-only; consolidate Status column OR import each bucket tab with injected ops status
2. Run Phase 8A preview → capture VALID / WARNING / INVALID counts
3. Import to quarantine company/branch with confirm_warnings policy signed
4. Capture Import Summary JSON
5. Pivot ERP: count by operational_status × branch_id
6. Pivot Excel: same buckets
7. Sample 50 tags: holder, issue/allocated, challan, remarks, category
8. Assert: active assignments == ASSIGNED count
9. Assert: no duplicate asset_code
10. Sign CR-004-Import-Validation-Report.md with measured tables
```

---

## 12. Verdict (this phase)

| Question | Answer |
|----------|--------|
| Can we certify Excel ↔ ERP parity today? | **No** — no measured import |
| Is the reconciliation framework ready? | **Yes** — this document + validation report + go-live checklist |
| Are structural blockers still open? | **Yes** — D-1…D-3 (8A.5 Critical) |

**Companion reports:** `CR-004-Import-Validation-Report.md`, `CR-004-GoLive-Checklist.md`
