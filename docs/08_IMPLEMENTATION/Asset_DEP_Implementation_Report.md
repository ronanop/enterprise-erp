# FP-ASSET-006 — Implementation Report

**Feature:** Asset Depreciation  
**ADR:** ADR-ASSET-DEP-001  
**Date:** 2026-07-29  
**Status:** IMPLEMENTATION COMPLETED

## 1. Executive Summary

Productized Asset Depreciation with SL/WDV/UoP calculation, period batch generation, Finance post with claim-before-post idempotency, reverse with claim-before-Finance and account swap for reversing journals, book-value sync on post/reverse, disposal gates, `:update` permission, draft-only Celery scheduler, and `AssetDepreciationWorkspace` (including asset history and batch status via existing list filters). No approval workflow (DEP-13).

## 2. Files Modified

Permissions, exceptions, workflow_codes, schemas, routers, asset repository (current_book_value update), depreciation engine/service/repo/tasks, assets page routing, security/OpenAPI tests.

## 3. Files Created

- `depreciation_validator.py`
- `0471_ast_depreciation_governance.py`
- `asset-depreciation-workspace.tsx`
- Unit/integration/scheduler tests
- ADR + Feature Package + Deployment/Migration/Release + this report

## 4. Database Migrations

`0471_ast_depreciation_governance` ← `0470`: update permission, period open index, ADEP backfill.

## 5. APIs Updated

`/api/v1/assets/asset-depreciations` — paginated list, generate-run, calculate, post, reverse; PATCH requires `:update`.

## 6. Frontend

`/assets/asset-depreciations` → `AssetDepreciationWorkspace`.

## 7. Tests

Engine formulas, validator, service idempotency/book value, reverse claim + account swap, concurrency (incl. reverse), scheduler, integration (calc/post/batch/fail/reverse/disposal gate), security, OpenAPI.

## 8. Documentation

`docs/ADR/ADR-ASSET-DEP-001.md`, `docs/08_IMPLEMENTATION/Asset_DEP_*`.

## 9. Breaking Changes

Create body requires period fields; list pagination shape; PATCH permission.

## 10. Known Limitations

No WF approval; scheduler never auto-posts (requires tenant/company/user or skips); account UUIDs required; period exclusivity app-level; reversing journal line descriptions remain adapter defaults.

## 11. Manual Verification

Upgrade `0471` → generate-run → calculate → post → verify book value → reverse.
