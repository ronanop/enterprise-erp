# Asset Location — Deployment Guide (FP-ASSET-012)

## Prerequisites

- Alembic head at `0476_ast_maint_plan_governance` or later
- Asset module API and web app deployed

## Steps

1. Deploy API with FP-ASSET-012 code.
2. Run migration: `alembic upgrade head` (applies `0477_ast_location_governance`).
3. Deploy web app with `AssetLocationWorkspace`.
4. Verify roles `ASSET_MANAGER`, `ASSET_EXECUTIVE`, `ASSET_ADMIN` have `asset.location:*` grants.
5. Smoke test: create location, supersede on second create, complete current row.

## Rollback

- Downgrade migration `0477` only if no production location data depends on new index (safe).
- Revert API/web to prior release if needed.
