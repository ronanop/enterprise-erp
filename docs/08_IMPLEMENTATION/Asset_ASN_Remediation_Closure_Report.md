# FP-ASSET-003 Remediation Closure Report

**Feature:** Asset Assignment (Allocation)  
**Mode:** Enterprise Remediation & Feature Closure  
**Date:** 2026-07-29

## 1. Review Findings Addressed

| Severity | Finding | Resolution |
|----------|---------|------------|
| Medium | Missing tests: reopen / resubmit / optimistic lock / shared multi-assign | Added unit + integration coverage |
| Medium | Ops validation (migration / build / CI) | Verified Alembic `0468` on PostgreSQL; asset pytest green; frontend production build fixed and re-run |
| Low | UI missing `allocation_type` filter | Wired filter control + query param to existing list API |
| Low | `cancel_draft` validation ordering | Validate `workflow_instance_id` before engine mutation; documented in Deployment Guide |
| Low | Unused `_db` / cleanup | Removed unused `AssignmentService._db`; fixed registration workspace type errors blocking build |

## 2. Files Modified

- `apps/api/src/modules/asset/service/assignment_service.py` — cancel_draft order; unused `_db` removed
- `apps/api/src/tests/unit/asset/test_assignment_concurrency.py` — **new**
- `apps/api/src/tests/integration/asset/test_asset_assignment_workflow.py` — reopen/resubmit test
- `apps/api/src/tests/unit/asset/test_workflow_codes.py` — include transfer code; expect len 6
- `apps/web/src/components/assets/asset-assignment-workspace.tsx` — allocation type filter
- `apps/web/src/components/assets/asset-registration-workspace.tsx` — typecheck fixes (generic list parse; Link without unsupported `asChild`)
- `apps/web/src/components/projects/project-form-page.tsx` — typecheck fix unblocking production build (`load` return typing)
- `docs/08_IMPLEMENTATION/Asset_ASN_Deployment_Guide.md` — cancel_draft rationale
- `docs/08_IMPLEMENTATION/Asset_ASN_Remediation_Closure_Report.md` — this report

## 3. Additional Tests Added

- `test_repository_rejects_stale_version` — optimistic locking / version conflict
- `test_shared_asset_allows_multiple_assignments` — shared asset skips exclusive pending check
- `test_int_asn_reopen_and_resubmit_creates_new_workflow_instance` — reopen after reject + resubmit new WF instance

## 4. Build & CI Results

| Check | Result |
|-------|--------|
| `pytest src/tests/unit/asset src/tests/security/asset src/tests/integration/asset` | **91 passed**, 2 skipped |
| Ruff (remediation-touched files) | **PASS** |
| `npm run typecheck` (apps/web) | **PASS** |
| `npm run build` (apps/web) | **PASS** |
| `npm run lint` (apps/web) | Pre-existing repo-wide ESLint failures (111 errors) — not introduced by FP-ASSET-003 |
| Full monorepo CI workflow | No GitHub Actions workflow present in repo; local quality gates used per README |

## 5. Migration Verification

- Alembic head: `0468_ast_assignment_governance`
- Upgrade path: `0467_ast_transfer_pending_index` → `0468` (already applied on local PostgreSQL `:5433`)
- Verified objects: `ix_ast_asset_assignment_asset_status_active`, permission `asset.assignment:update` (+ role grants)
- AASN sequence backfill: no existing `AASN-*` rows → sequence table empty (expected)

## 6. Remaining Known Limitations

- No hosted CI pipeline definition in-repo; gate coverage is local README checks
- Docker CLI not available in this environment; PostgreSQL verified via local process on port 5433
- Transfer `cancel_draft` still validates after engine (historical parity); Assignment deliberately improved
- `npm run lint` has pre-existing failures outside Assignment scope
- Production enablement evidence (`ASSET_WORKFLOW_GOVERNANCE_ENABLED=true` in prod) is outside this remediation

## 7. Final Risk Assessment

**Low.** Remediation is test/ops/UI-filter scoped; no ADR, schema, API contract, permission model, or workflow rule changes beyond safer cancel validation order and build-blocking type fixes.
