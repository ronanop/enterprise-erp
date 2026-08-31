# Asset Meter Reading — Migration Notes (FP-ASSET-015)

## Revision

`0480_ast_meter_reading_governance`

**Down revision:** `0479_ast_checklist_governance`

## Changes

1. `ix_ast_asset_meter_asset_id` on `(asset_id)` WHERE `is_deleted=false`
2. `ix_ast_asset_meter_asset_type_status` on `(asset_id, meter_type, status)` WHERE `is_deleted=false`
3. `ix_ast_asset_meter_reading_at` on `(reading_at)` WHERE `is_deleted=false`
4. `ix_ast_asset_meter_company_status` on `(company_id, status)` WHERE `is_deleted=false`

## Excluded

- No column changes
- No permission seeds

## Performance note

Text search uses `ILIKE` with conditional asset join. For very large tenants, consider future `pg_trgm` GIN indexes.
