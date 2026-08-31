# FP-ASSET-004 — Implementation Report

**Feature:** Asset Maintenance (Work Order Governance)  
**Date:** 2026-07-29  
**Status:** IMPLEMENTATION COMPLETED

## 1. Executive Summary

Productized maintenance work orders on the existing scaffold: domain validator, open-WO exclusivity, asset `in_maintenance`/`active` transitions, schedule/start/complete APIs, cancel/reopen/resubmit, service-history on complete, seeded `asset.maintenance:update`, additive migration `0469`, and a dedicated Maintenance workspace. ADR MNT-01–MNT-12 followed without architecture redesign.

## 2. Files Modified

- `apps/api/src/modules/asset/domain/exceptions.py`
- `apps/api/src/modules/asset/permissions.py`
- `apps/api/src/modules/asset/schemas.py`
- `apps/api/src/modules/asset/routers/__init__.py`
- `apps/api/src/modules/asset/service/maintenance_service.py`
- `apps/api/src/modules/asset/service/engines/asset_maintenance_engine.py`
- `apps/api/src/modules/asset/repository/asset_maintenance_repository.py`
- `apps/web/src/app/(app)/assets/[resource]/page.tsx`
- `apps/api/src/tests/integration/asset/conftest.py`
- `apps/api/src/tests/security/asset/test_asset_workflow_security.py`
- `apps/api/src/tests/unit/asset/test_asset_registration_routes.py`

## 3. Files Created

- `apps/api/src/modules/asset/service/maintenance_validator.py`
- `apps/api/alembic/versions/0469_ast_maintenance_governance.py`
- `apps/web/src/components/assets/asset-maintenance-workspace.tsx`
- `apps/api/src/tests/unit/asset/test_maintenance_validator.py`
- `apps/api/src/tests/unit/asset/test_maintenance_engine.py`
- `apps/api/src/tests/unit/asset/test_maintenance_concurrency.py`
- `apps/api/src/tests/unit/asset/test_maintenance_service.py`
- `apps/api/src/tests/integration/asset/test_asset_maintenance_workflow.py`
- `docs/ADR/ADR-ASSET-MNT-001.md`
- `docs/08_IMPLEMENTATION/Asset_MNT_Feature_Package.md`
- `docs/08_IMPLEMENTATION/Asset_MNT_Deployment_Guide.md`
- `docs/08_IMPLEMENTATION/Asset_MNT_Migration_Notes.md`
- `docs/08_IMPLEMENTATION/Asset_MNT_Release_Notes.md`

## 4. Database Migrations

- `0469_ast_maintenance_governance` (down: `0468`)
  - `asset.maintenance:update` + role grants
  - Partial index `ix_ast_asset_maintenance_asset_status_open`
  - AMNT sequence backfill

## 5. APIs Updated

`/api/v1/assets/asset-maintenances`:

- Paginated list with filters (`status`, `maintenance_type`, `q`, …)
- Expanded create/update schemas
- New: cancel, reopen, resubmit, schedule, start
- Existing: submit, approve, reject, complete

## 6. Frontend Pages Updated

- `/assets/asset-maintenances` → `AssetMaintenanceWorkspace` (not ResourceListView)

## 7. Tests Added

- Unit: validator, engine, concurrency/optimistic lock, service asset-status transitions
- Integration: submit, multi-approve → schedule → start → complete, reject/reopen/resubmit, cancel
- Security: SoD + update permission catalog
- OpenAPI: routes + list pagination schema

**Result:** Asset unit/security/integration suite green; maintenance-focused 37 passed.

## 8. Documentation Added

ADR, Feature Package, Deployment Guide, Migration Notes, Release Notes.

## 9. Breaking Changes

- Create body requires `asset_id`, `maintenance_type`
- List returns `{ items, total, page, page_size }` instead of bare array

## 10. Known Limitations

- Maintenance plan scheduler / Celery due jobs out of scope
- No Finance GL for `cost_amount`
- Partial open-WO index is not UNIQUE (exclusivity enforced in application layer, ADR MNT-03)
- `ASSET_WORKFLOW_GOVERNANCE_ENABLED` must be true in production

## 11. Manual Verification Steps

1. `alembic upgrade head` → confirm `0469`
2. Create WO → submit → 2 approves → schedule → start → confirm asset `in_maintenance`
3. Complete → confirm asset `active` + service history row
4. Attempt second open WO on same asset → validation error
5. Start with pending transfer → blocked
6. Creator cannot approve own WO (SoD)
7. UI: `/assets/asset-maintenances` full action set

## Verification Run

| Check | Result |
|-------|--------|
| pytest asset suites | PASS |
| alembic head / upgrade | `0469_ast_maintenance_governance` |
| npm typecheck | PASS |
| npm run build | PASS |
