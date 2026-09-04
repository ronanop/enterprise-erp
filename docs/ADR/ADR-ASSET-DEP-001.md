# ADR-ASSET-DEP-001 — Asset Depreciation

**Status:** Accepted  
**Date:** 2026-07-29  
**Package:** FP-ASSET-006  
**Depends on:** FP-ASSET-REG-001, FP-ASSET-005, Architecture Lock v1.1

---

## Problem

Depreciation existed as a thin scaffold (CRUD + status-only calculate + Finance post) without formulas, period/batch generation, eligibility gates, book-value sync, `:update` permission, or a product workspace. ERD does not define an approval workflow for depreciation.

## Decisions

| ID | Decision |
|----|----------|
| DEP-01 | Scope = period depreciation runs + Finance post; no multi-book/tax |
| DEP-02 | Methods: straight_line, wdv, units_of_production; UoP needs units + estimated_total on calculate |
| DEP-03 | `generate_period_run` creates draft rows + shared batch id; deterministic idempotency_key |
| DEP-04 | Reuse `AssetFinanceAdapter.post_depreciation`; operator supplies accounts |
| DEP-05 | Soft period-close awareness only; no Finance close implementation |
| DEP-06 | Block disposed/written_off and open disposals |
| DEP-07 | No revaluation hard dependency |
| DEP-08 | Seed `asset.depreciation:update`; PATCH requires it |
| DEP-09 | Dedicated `AssetDepreciationWorkspace` |
| DEP-10 | Additive migration only (permission, index, ADEP backfill) |
| DEP-11 | Scheduler creates drafts only — never calculate/post |
| DEP-12 | Alembic after `0470` → `0471_ast_depreciation_governance` |
| DEP-13 | No `AST_DEPRECIATION_APPROVAL` / no workflow_* columns |
| DEP-14 | Post updates `current_book_value`; reverse restores book value |
| DEP-15 | Claim-before-post idempotency |

## Formula notes

- **SL:** monthly = (purchase_cost − salvage) / useful_life_months; cap so book ≥ salvage  
- **WDV:** monthly = current_book_value / useful_life_months; cap at salvage  
- **UoP:** (cost − salvage) × (units_produced / estimated_total_units)

## References

- `docs/08_IMPLEMENTATION/Asset_DEP_Feature_Package.md`
