# ADR-ASSET-REV-001 — Asset Revaluation

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-007  
**Depends on:** FP-ASSET-005, FP-ASSET-006, Architecture Lock v1.1

---

## Problem

Asset Revaluation existed as a thin scaffold (CRUD + workflow stubs + Finance post) without validator, book-value sync, claim-before-post, cancel/reopen/resubmit, `:update` permission, search/pagination, or a product workspace.

## Decisions

| ID | Decision |
|----|----------|
| REV-01 | Scope = `ast_asset_revaluation` governance + Finance post + book sync; no reporting |
| REV-02 | Reuse `AST_REVALUATION_APPROVAL` (0266); no new workflow codes |
| REV-03 | Approve ≠ revalue; `current_book_value` updates **only** after successful Finance post |
| REV-04 | Reuse `AssetFinanceAdapter.post_revaluation`; amount = \|new − old\|; operator accounts |
| REV-05 | Capture `old_book_value` from asset; require `new_book_value` and `reason` |
| REV-06 | Eligible assets: active / in_maintenance; block disposed and written_off |
| REV-07 | Block open disposal; open-revaluation exclusivity at application layer |
| REV-08 | Soft guidance only for pending depreciation (no hard DEP coupling) |
| REV-09 | Audit create/update/submit/approve/reject/cancel/reopen/post |
| REV-10 | Notifications via existing governance only |
| REV-11 | Optimistic claim-before-post |
| REV-12 | Additive migration only (permission, open index, AREV backfill) |
| REV-13 | Seed `asset.revaluation:update`; PATCH requires it |
| REV-14 | Dedicated `AssetRevaluationWorkspace` |
| REV-15 | Cancel/reopen/resubmit parity with Disposal |
| REV-16 | Alembic after `0471` → `0472_ast_revaluation_governance` |

## References

- `docs/08_IMPLEMENTATION/Asset_REV_Feature_Package.md`
- ERD_15 §6.14
