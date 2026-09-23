# Asset CMP — Migration Notes

## Revision

`0484_ast_component_governance`  
`down_revision`: `0483_ast_report_governance`

## Changes

1. **Drop** absolute unique constraint `uk_ast_asset_component_code`.
2. **Create** partial unique index `uq_ast_asset_component_active_code` on `(asset_id, component_code)` where `status='active' AND is_deleted=false`.
3. **Indexes** (soft-delete filtered):
   - `ix_ast_asset_component_company_status`
   - `ix_ast_asset_component_asset_status`
   - `ix_ast_asset_component_company_code`
   - `ix_ast_asset_component_serial`
4. **Seed** permissions `asset.component:read|create|update` and grant to ASSET_MANAGER / EXECUTIVE / AUDITOR / ADMIN role sets.

## Data notes

Existing rows with duplicate `(asset_id, component_code)` where more than one is `active` will block index creation — resolve before upgrade. Historical replaced/disposed duplicates of an active code are expected and allowed.
