```
     # FP-ASSET-005 — Migration Notes
```

## Revision

`0470_ast_disposal_governance`  
**down_revision:** `0469_ast_maintenance_governance`

## Changes (additive only)

1. Seed permission `asset.disposal:update` and grant per ASSET_* role specs.
2. Partial index `ix_ast_asset_disposal_asset_status_open` on `(asset_id, status)` where
  `is_deleted = false AND status IN ('draft','submitted','approved')`.
3. Backfill `asset.ast_document_sequence` for existing `ADISP-YYYY-######` document numbers.

## Not included

- No new columns on `ast_asset_disposal`
- No enum / check-constraint changes
- No Finance schema changes
- No UNIQUE exclusivity constraint (application-level exclusivity; concurrent-create race accepted)



## Downgrade

Removes role grants for `asset.disposal:update`, deletes the permission row, drops the open index. Sequence rows are left in place.