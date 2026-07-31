# ADR-ASSET-DSP-001 — Asset Disposal (Retirement & Disposal Governance)

**Status:** Accepted  
**Date:** 2026-07-29  
**Package:** FP-ASSET-005  
**Depends on:** FP-ASSET-WF-GOV-001, FP-ASSET-REG-001, FP-ASSET-002, FP-ASSET-003, FP-ASSET-004, Architecture Lock v1.1

---

## Problem

Disposal existed as a scaffold (CRUD + submit/approve/reject/post + Finance adapter) without domain validation, open-disposal exclusivity, custody/ops gates (maintenance, assignment, transfer), cancel/reopen/resubmit, search/pagination, `asset.disposal:update`, or a product workspace.

## Decisions

| ID | Decision |
|----|----------|
| DSP-01 | Scope = `ast_asset_disposal` governance + post gates; no depreciation/revaluation rebuild |
| DSP-02 | Asset status changes **only on successful Finance `post`**; approve ≠ dispose; `write_off` → `written_off`; sale/scrap/donation → `disposed`; master via existing `mark_master_disposed` |
| DSP-03 | Reuse `AST_DISPOSAL_APPROVAL` (0266); reject → cancelled + rejected; cancel/reopen/resubmit parity with MNT |
| DSP-04 | Block create/submit/post if open maintenance WO exists |
| DSP-05 | Block if draft/submitted/approved/active assignment exists (return/cancel first) |
| DSP-06 | Block if pending transfer (`draft\|submitted\|approved`) exists |
| DSP-07 | Audit create/update/cancel/reopen/approve/post via AuditService |
| DSP-08 | Seed `asset.disposal:update`; PATCH requires it |
| DSP-09 | Dedicated `AssetDisposalWorkspace` |
| DSP-10 | Additive migration only (permission, open index, ADISP backfill); app-level exclusivity |
| DSP-11 | Reuse `AST_WF_*` notifications via AssetGovernanceService |
| DSP-12 | Single additive Alembic after `0469` (`0470_ast_disposal_governance`) |
| DSP-13 | Keep existing `post()` + `AssetFinanceAdapter.post_disposal`; no new GL logic |
| DSP-14 | One open disposal (`draft\|submitted\|approved`) per asset; reopen re-validates exclusivity |

## Consequences

- Breaking: disposal create body and list pagination shape (`AssetDisposalListResult`).
- Legacy approve when governance flag is off is non-production only.
- Concurrent open-disposal race documented (non-unique partial index).

## References

- `docs/08_IMPLEMENTATION/Asset_DSP_Feature_Package.md`
- `docs/08_IMPLEMENTATION/Asset_DSP_Deployment_Guide.md`
