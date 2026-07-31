# FP-ASSET-011 — Maintenance Plan Migration Notes

**Migration:** `0476_ast_maint_plan_governance`  
**Down revision:** `0475_ast_insurance_governance`

## Includes

- Partial index `ix_ast_asset_maint_plan_next_due_active` on `(next_due_date)` where `status='active'`
- `AMPL-*` document sequence backfill into `ast_document_sequence`
- Seed `asset.maintenance_plan:read|create|update|activate|pause|resume|close`
- Role grants for ASSET_MANAGER, ASSET_EXECUTIVE, ASSET_AUDITOR, ASSET_ADMIN

## Excludes

- No new business columns
- No status constraint changes (already matches ERD)
