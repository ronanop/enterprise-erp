# FP-ASSET-009 — Migration Notes

## Revision

`0474_ast_warranty_governance`  
Down revision: `0473_ast_audit_governance`

## Changes

| Change | Detail |
|--------|--------|
| CheckConstraint | Expand `ck_ast_asset_warranty_status` to include `draft`, `extended` |
| Index | Partial `ix_ast_asset_warranty_asset_status_open` on (`asset_id`,`status`) where `active`/`extended` |
| Permissions | Seed `asset.warranty:activate`, `:extend`, `:expire` + role grants |
| Document sequence | N/A — ERD has no warranty `document_number` |

## Non-changes

- No new tables
- No new business columns
- No workflow columns
- No Finance adapters
