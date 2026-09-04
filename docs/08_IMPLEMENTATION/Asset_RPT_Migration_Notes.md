# Asset RPT Migration Notes

## Revision

`0483_ast_report_governance`  
`down_revision`: `0482_ast_notification_governance`

## Changes

- Expand `ck_ast_asset_report_type` with ADR types
- Indexes: company+status, company+type, company+generated_at (partial `is_deleted=false`)

## Non-changes

- No table recreate
- No new columns
- No permission seed (already present)
