# Asset Service History — Migration Notes (FP-ASSET-013)

## Revision

`0478_ast_service_history_governance`

**Down revision:** `0477_ast_location_governance`

## Changes

1. `ix_ast_asset_svc_history_asset_id` on `(asset_id)` WHERE `is_deleted=false`
2. `ix_ast_asset_svc_history_maintenance_id` on `(maintenance_id)` WHERE `is_deleted=false`
3. `ix_ast_asset_svc_history_serviced_at` on `(serviced_at)` WHERE `is_deleted=false`

## Excluded

- No column changes
- No permission seeds
- No constraints

## Post-migration

- No data backfill required.
