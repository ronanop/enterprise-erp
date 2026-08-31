# CR-004 — Import Validation Report

**Phase:** 8C — Migration Validation & Reconciliation  
**Date:** 2026-08-05  
**Mode:** Analysis / validation only — **no backend, frontend, or business-logic changes**  
**Scope:** Verify Phase 8B import behaviour against Excel contract, CR-004 rules, and production cutover readiness

---

## Executive summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Migration Accuracy %** (measured Excel↔ERP) | **N/A (0%)** | No frozen workbook; zero production rows reconciled |
| **Migration Accuracy %** (design-time field/path capability)* | **72%** | Core READY/ASSIGNED paths strong; date/history/accessories/tab gaps |
| **Business Readiness %** (day-to-day IT ops in ERP) | **84%** | Inventory, assign/return, ops engine, export, register parity present |
| **Production Readiness %** (org-wide Excel retirement) | **62%** | Import engine exists; cutover blockers + unmeasured recon remain |
| **Go / No-Go** | **NO-GO** for Excel stop & production historical load | **CONDITIONAL GO** for quarantine dry-run only |

\*Design-time score weights: identity 20, ops paths 20, assignment fields 20, derived fields 15, distributions 10, cutover hygiene 15.

---

## 1. Validation scope results

### 1.1 Asset count

| Item | Status | Evidence |
|------|--------|----------|
| Import only VALID (+ confirmed WARNING) | **PASS** | `AssetExcelImportEngine` preview gates |
| ERROR never imports | **PASS** | Skip `invalid` / `error` |
| Duplicate skip (tag + serial) | **PASS** | Engine + `create_for_import` validator |
| Batch isolation | **PASS** | Savepoint per row; commit per batch |
| Measured Excel total = ERP total | **N/A** | No freeze kit |

### 1.2 Operational status

| Item | Status | Evidence |
|------|--------|----------|
| READY_TO_MOVE via registration activate | **PASS** | `approve` → `initialize_ready_to_move` |
| ASSIGNED via assignment activate | **PASS** | AssignmentService → `apply_action("assign")` |
| RETIRED via return outdated | **PASS** (path) / **PARTIAL** (history shape) | Matrix-compliant; synthetic assignment |
| PENDING_DISPOSAL via return dead | **PASS** (path) / **PARTIAL** (history) | Same |
| DISPOSED via complete_disposal | **PARTIAL** | Ops action; disposal doc parity weak |
| Excel tab-only status | **FAIL** | 8A.5 M-1 open |

### 1.3 Assignments

| Item | Status |
|------|--------|
| Employee | **PASS** when ID resolves |
| Issue Date → allocated_at | **FAIL** (stored as purchase_date / activation now) |
| Delivery Reference | **PASS** |
| Assignment Remarks | **PASS** |
| Return Remarks (Excel column) | **FAIL** (not in import mapping) |

### 1.4 Current Holder

| Item | Status |
|------|--------|
| Derived, not imported | **PASS** |
| Matches Excel when ASSIGNED employee correct | **PASS** (design) / **N/A** (measured) |

### 1.5 Earlier Used By

| Item | Status |
|------|--------|
| Not imported as writable | **PASS** |
| Derived from returned history in UI | **PASS** (register-parity) |
| Matches Excel free-text history after bulk load | **FAIL / PARTIAL** — synthetic returns distort history |

### 1.6 Branch / department / category

| Item | Status |
|------|--------|
| Branch required + mapped | **PASS** (design) |
| Department optional | **PARTIAL** |
| Category optional + default | **PARTIAL** — default skews distribution |

### 1.7 Import summary

| Counter | Produced by 8B | Validated against live run |
|---------|----------------|----------------------------|
| Total / Imported / Skipped / Duplicates / Warnings / Failed / Duration / Batch Count | **Yes** | **No** |

---

## 2. Verify checklist

| Verification | Result |
|--------------|--------|
| No duplicate assets (by design) | **PASS** — skip policy; measured uniqueness **N/A** |
| Operational status matches Excel | **PARTIAL** — path OK; tab/date/history gaps |
| Assignment history matches Excel | **FAIL** for multi-holder Excel; **PARTIAL** for single current assignment |
| Inventory totals match Excel | **N/A** |
| Dashboard totals match inventory | **PASS** (same ops summary service) / **N/A** post-import |

---

## 3. Differences

| Severity | Count (design findings) | Examples |
|----------|-------------------------|----------|
| Critical | 3 | No freeze file; multi-tab status; header hygiene |
| High | 4 | Issue date mapping; ASSIGNED policy; accessories; discovery fields not persisted |
| Medium | 4 | Synthetic assignments; return remarks; default category/cost; disposal doc |
| Low / accepted | 2 | Skip holder/earlier columns; skip phone |

Full register: `CR-004-Migration-Reconciliation.md` §10.

---

## 4. Warnings

1. Importing RETIRED/PENDING/DISPOSED creates **transit assignment history** Excel never showed.  
2. Default **purchase_cost = 0** and default **category** will pollute finance/category reports.  
3. `confirm_warnings` can admit ASSIGNED rows without employee if operators check the box incorrectly.  
4. First sheet only — silent under-import of other tabs.  
5. Parallel Excel edits during/after import will invalidate any future reconciliation.

---

## 5. Missing / unexpected / duplicate rows (templates)

| Class | Definition | Status |
|-------|------------|--------|
| Missing rows | In Excel VALID set, not in ERP after import | **N/A** until dry-run |
| Unexpected rows | In ERP quarantine, not in Excel source | **N/A** |
| Duplicate rows | Same Asset Tag in ERP twice | **Should be 0** by engine; confirm post-import SQL/API |

---

## 6. Phase 8A.5 blocker status after 8B

| ID | Item | After 8B |
|----|------|----------|
| M-1 | Sheet-name → ops status | **Still open** |
| M-2 | Title / merged headers | **Still open** |
| M-3 | Serial mapping | **Closed** (optional FE target + engine) |
| M-6 | ASSIGNED w/o employee = Error | **Still open** (Warning + confirm) |
| M-7 | Return Remarks | **Still open** |
| M-9 | Customer export SOP | **Still open** (process) |
| M-10 | Frozen real workbook | **Still open** |

**Conclusion:** 8B delivered the commit engine but **did not clear** the Critical cutover gates from 8A.5.

---

## 7. Test evidence (regression, not live recon)

| Suite | Result (as of 2026-08-05) |
|-------|---------------------------|
| Backend Phase 8B unit (engine/service/create/schemas/architecture) | 78 passed |
| Frontend excel-import + API mapper | 75 passed |

These prove **workflow wiring**, not Excel↔ERP numeric parity.

---

## 8. Remaining risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Mass wrong/missing status from multi-tab files | High | Critical | M-1 + freeze kit before any prod import |
| Issue dates wrong in ERP | High | High | Map Issue Date → `allocated_at` in a future hardening phase (out of 8C scope) |
| Synthetic history confuses audits | Medium | High | Document; optionally quarantine retired imports |
| Dual Excel + ERP divergence | High | High | Freeze Excel writes for in-scope tags |
| Default category/cost | Medium | Medium | Require category column or per-row category in template |
| Unmeasured recon signed off prematurely | Medium | Critical | Require filled count tables in this report |

---

## 9. Final recommendation

| Decision | Recommendation |
|----------|----------------|
| Org-wide **stop using Excel** | **NO-GO** |
| Production historical **import to live branches** | **NO-GO** |
| Quarantine **dry-run** import (Status-column sheet, trained operator, snapshot) | **CONDITIONAL GO** |
| Day-to-day ops for assets **already in ERP** | **CONDITIONAL GO** (unchanged from Phase 5) |

**Next actions (process / future phases — not implemented in 8C):**

1. Obtain frozen workbook (hash + date) — M-10  
2. Close M-1 / M-2 / M-9  
3. Execute quarantine import + fill measured tables in §1 / Reconciliation §1  
4. Two-week parallel run with zero Excel writes for in-scope assets  
5. Re-score Migration Accuracy % from measured deltas  

---

## Document control

| Item | Value |
|------|-------|
| Code changes | None |
| Companion | `CR-004-Migration-Reconciliation.md`, `CR-004-GoLive-Checklist.md` |
