# CR-004 — Phase 1 Business Analysis

**Title:** IT Asset Operations & Inventory Management  
**Phase:** 1 — Analysis & Architecture Planning (documentation only)  
**Baseline:** Architecture Lock v1.1, FP-ASSET-001 → FP-ASSET-019, CR-001 → CR-003  
**Date:** 2026-08-03

---

## 1. Executive intent

CR-004 replaces the customer’s **Excel-based IT asset operations** with the existing Enterprise Asset Management module. The customer does not need a parallel system; they need **operational clarity** (ready / assigned / retired / dead / disposed) and **branch inventory** (Noida, Mumbai, Dubai) on top of capabilities already built.

This phase defines **what** to add and **how** it fits the locked architecture. No implementation occurs in Phase 1.

---

## 2. Customer process (Excel) — normalized view

| Excel concept | Business meaning |
|---------------|------------------|
| Employee Asset Register | Master operational view: who has what, when issued, where, accessories, remarks |
| Ready To Move | Stock available for next assignment |
| Assigned Assets | Currently issued to employees |
| Not Given To Anyone | Outdated; never assign again (retired stock) |
| Not Working | Dead asset; must enter disposal path |
| Branch Inventory | Quantity/availability by branch (Noida, Mumbai, Dubai) |

---

## 3. Locked operational statuses (CR-004)

| Status | Definition |
|--------|------------|
| `READY_TO_MOVE` | Available for assignment |
| `ASSIGNED` | Currently issued (custody active) |
| `RETIRED` | Outdated; do not assign again |
| `PENDING_DISPOSAL` | Non-functional; awaiting disposal workflow |
| `DISPOSED` | Terminal; disposed through governance |

These are **IT operations statuses**, distinct from but related to existing **`ast_asset.status`** lifecycle (`draft` → `active` → `disposed`, etc.) and **assignment document status** (`active` / `returned`).

---

## 4. Stakeholders & outcomes

| Stakeholder | Outcome |
|-------------|---------|
| IT Admin | Replace Excel tabs with filtered register views and branch inventory |
| HR / Ops | See assignment history without duplicating employee master |
| Finance | No change to depreciation/disposal posting rules in Phase 1 scope |
| Auditors | Trail via existing audit engine + assignment/disposal documents |

---

## 5. Scope boundaries

### In scope (later phases)

- Operational status on the asset register (single source of truth)
- Excel-equivalent **views** (filters, not duplicate tables)
- Branch-scoped inventory KPIs
- Assignment enrichment (delivery challan reference, remarks) without duplicating employee/product data
- Integration rules: assignment activate/return ↔ operational status; disposal post ↔ `DISPOSED`

### Out of scope (Phase 1 / explicit non-goals)

- New asset module or duplicate register table
- Changing CR-001 category rules, CR-002 portal/QR, CR-003 discovery allowlists
- Rewriting workflow definitions
- Finance-heavy executive dashboards

---

## 6. Business rules (recommended)

1. **One asset row** in `ast_asset` per physical device; Excel rows map to asset + optional components (charger, accessories).
2. **Employee identity** comes from `master_employee`; phone/name are not stored on assignment except via master read models.
3. **Brand/model/configuration** come from product/vendor master, discovery JSON, or asset name — not a second laptop table.
4. **Earlier used by** is **assignment history**, not a free-text column on the asset.
5. **Ready To Move** requires: register `active` (or approved IT policy equivalent), operational `READY_TO_MOVE`, no active assignment.
6. **Not Working** transitions to `PENDING_DISPOSAL`; disposal **post** sets operational `DISPOSED` and aligns with `AssetEngine.dispose`.

---

## 7. Success criteria (for implementation phases)

- IT Admin can run daily operations without Excel for the five Excel buckets + branch inventory.
- No architectural drift (Router → Service → Validator → Engine → Repository).
- Existing APIs remain backward compatible (additive fields/endpoints only).
- CR-001/002/003 regression suites pass.

---

## 8. References

- ERD_15 Asset Management (`docs/06_ERD/ERD_15_Asset_Management.md`)
- CR-001/002/003 change requests
- `apps/api/src/modules/asset/domain/enums.py` — current lifecycle enums
- Locked sidebar: `apps/web/src/config/assets.ts`
