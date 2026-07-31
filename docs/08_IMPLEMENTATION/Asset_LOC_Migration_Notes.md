# Asset Location — Migration Notes (FP-ASSET-012)

## Revision

`0477_ast_location_governance`

**Down revision:** `0476_ast_maint_plan_governance`

## Changes

1. **Partial index** `ix_ast_asset_location_current` on `asset.ast_asset_location(asset_id)` where `is_deleted = false AND is_current = true`.
2. **Permission seed/grants** for `asset.location:read`, `asset.location:create`, `asset.location:complete` across asset roles.

## No schema column changes

Existing `ast_asset_location` table unchanged.

## Post-migration

- No data backfill required.
- Transfer-created location rows remain valid.
