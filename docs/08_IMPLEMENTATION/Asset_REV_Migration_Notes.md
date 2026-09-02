# FP-ASSET-007 — Migration Notes

## Revision

`0472_ast_revaluation_governance`  
`down_revision`: `0471_ast_depreciation_governance`

## Contents

- Seed `asset.revaluation:update` + role grants
- Partial index `ix_ast_asset_revaluation_asset_status_open` on `(asset_id, status)` where open statuses
- AREV document sequence backfill into `ast_document_sequence`

## Not included

- No new business columns
- No ERD redesign
- No workflow definition changes
