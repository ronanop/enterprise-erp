# CR-004 — Production Readiness

**Date:** 2026-08-05  
**Companion:** `CR-004-Business-Validation-Report.md`, `CR-004-UAT-Checklist.md`  
**Mode:** Analysis only

---

## 1. Readiness summary

| Dimension | Score | Status |
|-----------|-------|--------|
| Overall completion | **82%** | Core ops built; migration/export/history gaps |
| Production readiness (pilot) | **70%** | Conditional GO for one-branch pilot |
| Excel replacement readiness | **55%** | NO-GO for org-wide Excel retirement |
| Architecture lock compliance | **High** | Ops engine, SSOT, no direct PATCH |
| Test automation (FE assignment/inventory) | **High** | Large Vitest coverage on FE paths |
| Data cutover | **Low** | Import not implemented |

---

## 2. What is production-ready now

Safe to enable **for assets already in ERP**, with trained IT Admin:

- Inventory presets (Ready / Assigned / Retired / Pending Disposal)
- Branch-scoped inventory + dashboard KPIs
- Issue wizard (draft / submit / activate path)
- Return wizard with Good / Outdated / Dead → correct ops transitions
- Disposal posting → `DISPOSED`
- Deep links and Inventory ↔ Wizard soft navigation
- Operational status engine as sole transition authority

---

## 3. What is not production-ready for Excel retirement

| Gap | Severity | Blocks |
|-----|----------|--------|
| Excel import / cutover | Critical | Org Excel stop |
| IT register export/report | Critical | Audit/sign-off without Excel |
| Earlier Used By derivation in UI | High | Register parity |
| Live challan/remarks on inventory drawer | High | Register parity |
| Dashboard auto-refresh after workflows | Medium | Ops confidence |
| Dual assignment UIs (legacy + wizard) | Medium | Training / wrong path |
| Sidebar Phase 3.5 | Medium | Nav polish |
| Multi-approver activate friction | Medium | “Instant issue” expectation |

---

## 4. Deployment checklist (pilot)

| # | Item | Owner | Done |
|---|------|-------|------|
| 1 | Migrations applied (ops status + assignment enrichment) | Eng | `[ ]` |
| 2 | Permissions: assign / return / dispose / inventory | Admin | `[ ]` |
| 3 | Seed Ready assets + employees for pilot branch | Admin | `[ ]` |
| 4 | UAT checklist B–I executed | IT Admin | `[ ]` |
| 5 | Disable/communicate: do not use legacy assignment return for Excel outcomes | IT Lead | `[ ]` |
| 6 | Parallel Excel kept for history only | Business | `[ ]` |
| 7 | Rollback plan (feature flag / route hide wizards) | Eng | `[ ]` |
| 8 | Support runbook for failed activate / return errors | Eng | `[ ]` |

---

## 5. Production risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Dual systems (Excel + ERP) diverge | High | High | Time-box pilot; freeze Excel edits for pilot assets |
| User uses legacy assignment UI | Medium | Medium | Hide return on legacy or redirect to wizard |
| Workflow leaves assignment submitted | Medium | Medium | Document approval path; monitor status |
| Stale dashboard KPIs | Medium | Low | Refresh page; later event bus |
| Import later overwrites live ops | Low | High | Import only into empty/quarantine branch first |

---

## 6. Definition of Done — Excel retirement

Excel may be declared **retired** when all are true:

1. [ ] UAT J1–J5 passed  
2. [ ] Critical C-1 (import) and C-2 (export) closed  
3. [ ] High H-1 / H-2 closed (Earlier Used By + challan/remarks on register)  
4. [ ] Two-week parallel run with zero Excel writes for in-scope assets  
5. [ ] Business Owner sign-off on `CR-004-UAT-Checklist.md`  
6. [ ] Reconciliation: ops status vs active assignments (Phase 7 job or manual)  

Until then: **ERP = system of record for new ops; Excel = historical archive only** (pilot policy).

---

## 7. Recommended go-live stages

```text
Stage 0 — Internal dogfood (eng + one IT user)
Stage 1 — Single branch pilot (new assets only)     ← CONDITIONAL GO now
Stage 2 — Register parity sprint (H-1, H-2, export)
Stage 3 — Import historical Excel (C-1)
Stage 4 — Org-wide Excel stop                       ← after DoD above
```

---

## 8. Go / No-Go board

| Scope | Recommendation | Conditions |
|-------|----------------|------------|
| Stage 1 pilot | **GO** | UAT B–I pass; training; Excel read-only for pilot assets |
| Org production ops (keep Excel) | **GO** | Same + support coverage |
| Org Excel stop | **NO-GO** | Complete Critical + High register gaps + import/export |

---

## 9. Scores (authoritative for Phase 5 validation)

1. **Overall Completion %:** 82%  
2. **Production Readiness %:** 70% (pilot) / ~45% (Excel cutover)  
3. **Excel Replacement Readiness %:** 55%  
4. **Critical blockers:** Excel import; IT register export; (practically also Earlier Used By + drawer challan/remarks for parity)  
5. **Sprint plan:** See Business Validation Report § Recommended Sprint Plan (S1–S5)  
6. **Go / No-Go:** **NO-GO** for Excel stop · **CONDITIONAL GO** for pilot  

---

## 10. Document control

| Doc | Role |
|-----|------|
| `CR-004-Business-Validation-Report.md` | Full PASS/FAIL analysis |
| `CR-004-UAT-Checklist.md` | Executable acceptance tests |
| `CR-004-Production-Readiness.md` | This file — release gates |
