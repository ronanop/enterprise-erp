# FP-ASSET-006 — Migration Notes

**Revision:** `0471_ast_depreciation_governance`  
**down_revision:** `0470_ast_disposal_governance`

## Changes

- Seed `asset.depreciation:update` + role grants
- Partial index on non-reversed period rows `(asset_id, period_year, period_month)`
- ADEP sequence backfill

No business/workflow columns added.
