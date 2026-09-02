# Asset Assignment — Migration Notes (FP-ASSET-003)

## Revision

`0468_ast_assignment_governance`  
`down_revision`: `0467_ast_transfer_pending_index`

## Upgrade

1. Insert `asset.assignment:update` if missing; grant to ASSET_MANAGER / ASSET_EXECUTIVE / ASSET_ADMIN (and auditor if role matrix includes update — managers/admins only per seed pattern).
2. Create partial index `ix_ast_asset_assignment_asset_status_active` on `(asset_id, status)` where not deleted and status in draft/submitted/approved/active.
3. Backfill `ast_document_sequence` from existing `AASN-YYYY-NNNNNN` documents.

## Downgrade

- Drop index
- Remove role grants and `asset.assignment:update` permission

No business column changes.
