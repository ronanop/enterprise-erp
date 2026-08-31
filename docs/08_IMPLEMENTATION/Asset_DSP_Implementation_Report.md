# FP-ASSET-005 — Implementation Report

**Feature:** Asset Disposal (Retirement & Disposal Governance)  
**ADR:** ADR-ASSET-DSP-001  
**Date:** 2026-07-29  
**Status:** IMPLEMENTATION COMPLETED

---

## 1. Executive Summary

FP-ASSET-005 productizes Asset Disposal using the same governance patterns as Assignment and Maintenance: validator, cancel/reopen/resubmit, search/pagination, open-disposal exclusivity, gates for open maintenance / open assignment / pending transfer, seeded `asset.disposal:update`, and a dedicated `AssetDisposalWorkspace`. Finance post remains the irreversible completion step; asset status changes only after successful journal posting (`disposed` or `written_off`).

---

## 2. Files Modified

| Path | Change |
|------|--------|
| `apps/api/src/modules/asset/permissions.py` | Added `asset.disposal:update` |
| `apps/api/src/modules/asset/domain/exceptions.py` | Added `DisposalValidationError` |
| `apps/api/src/modules/asset/schemas.py` | Expanded create/update/response; `AssetDisposalListResult` |
| `apps/api/src/modules/asset/routers/__init__.py` | Paginated list; cancel/reopen/resubmit; PATCH `:update` |
| `apps/api/src/modules/asset/service/disposal_service.py` | Full productization |
| `apps/api/src/modules/asset/service/engines/asset_disposal_engine.py` | cancel/reopen |
| `apps/api/src/modules/asset/service/engines/asset_engine.py` | `dispose(..., disposal_type=)` → written_off/disposed |
| `apps/api/src/modules/asset/repository/asset_disposal_repository.py` | search, find_pending, optimistic lock |
| `apps/web/src/app/(app)/assets/[resource]/page.tsx` | Wire disposal workspace |
| `apps/api/src/tests/integration/asset/conftest.py` | Disposal table + WF seed |
| `apps/api/src/tests/security/asset/test_asset_workflow_security.py` | SoD + update permission |
| `apps/api/src/tests/unit/asset/test_asset_registration_routes.py` | OpenAPI disposal routes |

---

## 3. Files Created

| Path |
|------|
| `apps/api/src/modules/asset/service/disposal_validator.py` |
| `apps/api/alembic/versions/0470_ast_disposal_governance.py` |
| `apps/web/src/components/assets/asset-disposal-workspace.tsx` |
| `apps/api/src/tests/unit/asset/test_disposal_validator.py` |
| `apps/api/src/tests/unit/asset/test_disposal_engine.py` |
| `apps/api/src/tests/unit/asset/test_disposal_service.py` |
| `apps/api/src/tests/unit/asset/test_disposal_concurrency.py` |
| `apps/api/src/tests/integration/asset/test_asset_disposal_workflow.py` |
| `docs/ADR/ADR-ASSET-DSP-001.md` |
| `docs/08_IMPLEMENTATION/Asset_DSP_Feature_Package.md` |
| `docs/08_IMPLEMENTATION/Asset_DSP_Deployment_Guide.md` |
| `docs/08_IMPLEMENTATION/Asset_DSP_Migration_Notes.md` |
| `docs/08_IMPLEMENTATION/Asset_DSP_Release_Notes.md` |
| `docs/08_IMPLEMENTATION/Asset_DSP_Implementation_Report.md` |

---

## 4. Database Migrations

- **Revision:** `0470_ast_disposal_governance`
- **Down revision:** `0469_ast_maintenance_governance`
- Seeds `asset.disposal:update` + role grants
- Partial index `ix_ast_asset_disposal_asset_status_open`
- ADISP sequence backfill

---

## 5. APIs Updated

Base: `/api/v1/assets/asset-disposals`

- `GET /` → `AssetDisposalListResult` with filters `status`, `disposal_type`, `asset_id`, `branch_id`, `q`
- `POST /` requires `asset_id`, `disposal_type`
- `PATCH /{id}` requires `asset.disposal:update` + `version`
- `POST /{id}/cancel|reopen|resubmit`
- Existing submit/approve/reject/post retained with gates

---

## 6. Frontend Pages Updated

- `/assets/asset-disposals` → `AssetDisposalWorkspace` (list, search, filters, draft CRUD, workflow actions, Finance post UUIDs, SoD messaging)

---

## 7. Tests Added

- Unit: validator, engine (incl. write_off), service, concurrency
- Integration: submit, 3-step approve + post, write_off status, reject/reopen/resubmit, cancel, exclusivity, MNT/ASN/TRF gates
- Security: SoD approve, workflow instance required, update permission catalogued
- OpenAPI: disposal routes + list schema

**Verification:** Remediation suite 58 passed; Alembic head `0470_ast_disposal_governance`. Post idempotency claim-before-Finance landed in remediation closure.

---

## 8. Documentation Added

ADR-ASSET-DSP-001, Feature Package, Deployment Guide, Migration Notes, Release Notes, this Implementation Report.

---

## 9. Breaking Changes

1. Create body no longer accepts stub `{branch_id, status}` only.
2. List response shape is paginated `AssetDisposalListResult`.
3. PATCH requires `asset.disposal:update`.

---

## 10. Known Limitations

- Open-disposal exclusivity is application-level (non-unique partial index); concurrent-create race accepted (DSP-10).
- Operators must supply debit/credit account UUIDs for post.
- Master sync always uses `mark_master_disposed` (`disposed`) even when operational asset is `written_off`.

---

## 11. Manual Verification Steps

1. Upgrade Alembic to `0470`.
2. Confirm `asset.disposal:update` granted.
3. UI: create draft → submit → approve (non-creator, all WF steps) → post with account UUIDs → asset `disposed` / `written_off`.
4. Confirm open WO / open assignment / pending transfer block create/submit.
5. Confirm approve does not change asset status.
6. Confirm SoD messaging when creator attempts approve.
