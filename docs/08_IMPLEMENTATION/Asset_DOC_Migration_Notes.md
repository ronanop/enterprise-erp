# Asset Document Management — Migration Notes (FP-ASSET-016)

## Revision

`0481_ast_document_governance`

**Down revision:** `0480_ast_meter_reading_governance`

## Changes

1. `ix_ast_asset_document_asset_id` on `(asset_id)` WHERE `is_deleted=false`
2. `ix_ast_asset_document_asset_type_status` on `(asset_id, document_type, status)` WHERE `is_deleted=false`
3. `ix_ast_asset_document_company_status` on `(company_id, status)` WHERE `is_deleted=false`
4. `ix_ast_asset_document_type` on `(document_type)` WHERE `is_deleted=false`

## Excluded

- No column changes
- No permission seeds (already present)
- No unique constraints

## Performance note

Text search uses `ILIKE` with conditional asset join. For very large tenants, consider future `pg_trgm` GIN indexes.
