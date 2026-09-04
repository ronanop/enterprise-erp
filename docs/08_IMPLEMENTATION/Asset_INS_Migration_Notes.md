# FP-ASSET-010 — Migration Notes

## Revision

`0475_ast_insurance_governance`  
Down revision: `0474_ast_warranty_governance`

## Changes

| Change | Detail |
|--------|--------|
| CheckConstraint | Expand `ck_ast_asset_insurance_status` to include `draft`, `renewed` |
| Index | Partial `ix_ast_asset_insurance_asset_status_open` on (`asset_id`,`status`) where `active`/`renewed` |
| Permissions | Seed `asset.insurance:activate`, `:renew`, `:expire`, `:close` + role grants |
| Document sequence | N/A — ERD has no insurance `document_number` |

## Non-changes

- No new tables
- No new business columns
- No workflow columns
- No Finance adapters
