# CR-004 — Go-Live Checklist

**Phase:** 8C — Migration Validation & Reconciliation  
**Date:** 2026-08-05  
**Mode:** Checklist / validation only — **no product code changes in this phase**  
**Purpose:** Gate decisions for pilot ops, quarantine import dry-run, and org-wide Excel retirement

---

## Decision board (current)

| Gate | Recommendation | Date |
|------|----------------|------|
| Day-to-day IT ops (assets already in ERP) | **CONDITIONAL GO** | 2026-08-05 |
| Quarantine Excel import dry-run | **CONDITIONAL GO** | 2026-08-05 |
| Production historical import (live branches) | **NO-GO** | 2026-08-05 |
| Org-wide Excel retirement | **NO-GO** | 2026-08-05 |

Scores: see `CR-004-Import-Validation-Report.md`  
Reconciliation detail: `CR-004-Migration-Reconciliation.md`

---

## A. Platform prerequisites

| # | Item | Owner | Done |
|---|------|-------|------|
| A1 | Alembic migrations applied (ops status, assignment enrichment, discovery as required) | Eng | `[ ]` |
| A2 | Permissions: asset create/submit/approve, assignment create/submit/approve/return, inventory read | Admin | `[ ]` |
| A3 | Branches (Noida / Mumbai / Dubai or customer set) match Excel labels | Org Admin | `[ ]` |
| A4 | Employees resolvable by EMP code used in Excel | HR / MD | `[ ]` |
| A5 | At least one active IT asset category for import defaults | Asset Admin | `[ ]` |
| A6 | Workflow governance setting understood (legacy approve vs SoD) for import operator | Eng | `[ ]` |
| A7 | DB snapshot / restore point before any import | Ops | `[ ]` |

---

## B. Excel freeze kit (blocks production import)

| # | Item | Owner | Done |
|---|------|-------|------|
| B1 | Frozen `.xlsx` received (file name, date, SHA-256) | Business | `[ ]` |
| B2 | Values-only export (no live formulas) | Business | `[ ]` |
| B3 | Headers unmerged; row 1 = column headers | Business | `[ ]` |
| B4 | Status strategy: **Status column** on one sheet **or** documented per-tab import plan | IT + Eng | `[ ]` |
| B5 | Duplicate Asset Tags cleaned in file | IT | `[ ]` |
| B6 | ASSIGNED rows all have Employee ID | IT | `[ ]` |
| B7 | Branch labels match ERP master (or alias list signed) | IT | `[ ]` |
| B8 | 8A.5 Critical items M-1, M-2, M-9, M-10 closed or waived in writing | PMO | `[ ]` |

---

## C. Preview validation (Phase 8A)

| # | Item | Owner | Done |
|---|------|-------|------|
| C1 | Upload on `/assets/inventory-import` | IT Admin | `[ ]` |
| C2 | Column mapping reviewed (aliases confirmed) | IT Admin | `[ ]` |
| C3 | Record VALID / WARNING / INVALID counts | IT Admin | `[ ]` |
| C4 | Zero unexpected mass invalids (branch/employee) | IT Admin | `[ ]` |
| C5 | WARNING policy decided (`confirm_warnings` yes/no) and signed | Business | `[ ]` |
| C6 | Default category selected consciously | IT Admin | `[ ]` |

---

## D. Quarantine import dry-run (Phase 8B)

| # | Item | Owner | Done |
|---|------|-------|------|
| D1 | Import target = quarantine company/branch only | Eng | `[ ]` |
| D2 | Execute Import; save Import Summary JSON | IT Admin | `[ ]` |
| D3 | Fill Asset Count table in Migration Reconciliation | QA | `[ ]` |
| D4 | Fill Ops Status pivot Excel vs ERP | QA | `[ ]` |
| D5 | Sample 50 rows: tag, holder, challan, remarks, branch, category | QA | `[ ]` |
| D6 | Assert no duplicate `asset_code` | QA | `[ ]` |
| D7 | Assert ASSIGNED count = active assignments | QA | `[ ]` |
| D8 | Dashboard KPIs match inventory filters for quarantine | QA | `[ ]` |
| D9 | Document differences (missing / unexpected / duplicate) | QA | `[ ]` |
| D10 | Migration Accuracy % recalculated from measured deltas | PMO | `[ ]` |

**Dry-run exit:** Accuracy ≥ **98%** on in-scope columns **or** Business accepts documented deltas in writing.

---

## E. Assignment & derived fields

| # | Item | Owner | Done |
|---|------|-------|------|
| E1 | Current Holder correct for ASSIGNED sample | QA | `[ ]` |
| E2 | Earlier Used By acceptable given synthetic RETIRED path (or waived) | Business | `[ ]` |
| E3 | Issue Date vs allocated_at gap accepted or deferred fix logged | Business | `[ ]` |
| E4 | Delivery reference present where Excel had challan | QA | `[ ]` |
| E5 | Return remarks historical gap accepted | Business | `[ ]` |

---

## F. Parallel run (Excel retirement path)

| # | Item | Owner | Done |
|---|------|-------|------|
| F1 | In-scope Asset Tags frozen in Excel (read-only / archived) | Business | `[ ]` |
| F2 | All new issues/returns done in ERP only | IT Admin | `[ ]` |
| F3 | Two-week parallel with zero Excel writes for in-scope tags | Business | `[ ]` |
| F4 | Weekly recon: ops status × branch | QA | `[ ]` |
| F5 | Export register (Phase 7A) used for audits instead of Excel | IT Admin | `[ ]` |

---

## G. UAT / business sign-off

| # | Item | Owner | Done |
|---|------|-------|------|
| G1 | UAT checklist B–I (ops) passed | IT Admin | `[ ]` |
| G2 | UAT J (Excel stop criteria) passed | Business | `[ ]` |
| G3 | Import Validation Report updated with measured scores | PMO | `[ ]` |
| G4 | IT Admin sign-off | IT Admin | `[ ]` |
| G5 | Business Owner sign-off | Business | `[ ]` |
| G6 | Architecture / Eng sign-off (lock compliance) | Eng | `[ ]` |

---

## H. Rollback

| # | Item | Owner | Done |
|---|------|-------|------|
| H1 | Snapshot ID recorded before import | Ops | `[ ]` |
| H2 | Rollback drill documented (restore quarantine) | Ops | `[ ]` |
| H3 | Resume Excel procedure if dry-run fails | Business | `[ ]` |
| H4 | Feature hide path for import route if needed | Eng | `[ ]` |

---

## I. Explicit non-goals before Excel stop

Do **not** declare Excel retired while any remain open:

- [ ] Critical cutover gaps M-1 / M-2 / M-9 / M-10  
- [ ] Unmeasured Migration Accuracy (still N/A)  
- [ ] Dual assignment UI confusion unmitigated (legacy vs wizard) — optional but recommended  
- [ ] Accessories / serial completeness waived without Business sign-off  

---

## Sign-off block

| Role | Name | Date | Gate signed | Decision |
|------|------|------|-------------|----------|
| IT Admin | | | Pilot ops / Dry-run | GO / NO-GO |
| Business Owner | | | Excel stop | GO / NO-GO |
| Engineering | | | Import technical | GO / NO-GO |
| PMO | | | Overall | GO / NO-GO |

**Current overall (unsigned analysis):** **NO-GO** for Excel stop · **CONDITIONAL GO** for quarantine dry-run after B1–B8.
