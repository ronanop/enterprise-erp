# Asset NTF Migration Notes

## Revision

`0482_ast_notification_governance`  
`down_revision`: `0481_ast_document_governance`

## Changes

### Indexes (partial `is_deleted = false`)

- `ix_ast_asset_notification_company_status`
- `ix_ast_asset_notification_company_delivery`
- `ix_ast_asset_notification_company_type`
- `ix_ast_asset_notification_asset`
- `ix_ast_asset_notification_recipient_delivery`

### Permissions seeded

- `asset.notification:read`
- `asset.notification:create`
- `asset.notification:update`

Granted to ASSET_MANAGER, ASSET_EXECUTIVE, ASSET_AUDITOR (read), ASSET_ADMIN per role matrices.

## Non-changes

- Table `ast_asset_notification` schema unchanged (ERD §6.19).
- No CHECK constraint expansion for types.
- No data backfill.
