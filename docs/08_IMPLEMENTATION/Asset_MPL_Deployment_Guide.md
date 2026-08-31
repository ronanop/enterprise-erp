# FP-ASSET-011 — Maintenance Plan Deployment Guide

1. Apply migration `0476_ast_maint_plan_governance`.
2. Verify `asset.maintenance_plan:*` permissions are granted to ASSET_* roles.
3. Deploy API and web; confirm `/assets/maintenance-plans` loads workspace.
4. Celery `asset.maintenance_due_alerts` remains count-only (no change).

Rollback: downgrade `0476` removes permissions and partial index only.
