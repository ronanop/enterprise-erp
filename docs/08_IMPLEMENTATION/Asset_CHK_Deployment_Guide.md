# Asset Checklist — Deployment Guide (FP-ASSET-014)

## Prerequisites

- Alembic head at `0478_ast_service_history_governance` or later
- FP-ASSET-REG-001 asset registration deployed
- FP-ASSET-005 maintenance and FP-ASSET-008 audit available for parent pickers

## Pre-deploy validation

Run duplicate-code detection before applying `0479` (see `Asset_CHK_Migration_Notes.md`).  
Deployment **fails** if active duplicate `(company_id, checklist_code)` pairs exist.

## Steps

1. Deploy API with FP-ASSET-014 code.
2. Run duplicate `checklist_code` detection query; remediate if needed.
3. Run `alembic upgrade head` (applies `0479_ast_checklist_governance`).
4. Deploy web app with `AssetChecklistWorkspace`.
5. Verify RBAC roles include `asset.checklist:read`, `:create`, `:update` (already seeded).
6. Smoke test: create draft checklist, edit items, complete, verify list filters.

## Rollback

- Downgrade `0479` drops indexes only (safe).
- Revert API/web if needed; no data migration required.
