# Asset Maintenance — Migration Notes (FP-ASSET-004)

## Revision

`0469_ast_maintenance_governance`  
Down revision: `0468_ast_assignment_governance`

## Changes

| Object | Action |
|--------|--------|
| `foundation.sec_permission` | Insert `asset.maintenance:update` if missing |
| `foundation.sec_role_permission` | Grant to ASSET_* roles when role exists |
| `asset.ix_ast_asset_maintenance_asset_status_open` | Partial index (open statuses) |
| `asset.ast_document_sequence` | Backfill max+1 for existing `AMNT-YYYY-*` |

## No schema column changes

No new business columns on `ast_asset_maintenance`.

## Downgrade

Drops index and removes the update permission + role grants. Prefer forward-fix.
