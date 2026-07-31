# Asset NTF Release Notes

## FP-ASSET-017 — Asset Notification

### Added

- Enterprise asset alert **metadata registry** (`ast_asset_notification`)
- Lifecycle: active → archived; delivery pending → sent → read / pending → failed
- APIs for archive, mark-read, mark-sent, mark-failed
- RBAC `asset.notification:*`
- `AssetNotificationWorkspace` (ops inbox for metadata — not a messaging composer)

### Clarified

- Foundation Notification remains the only delivery engine (email/SMS/WhatsApp/in-app).
- Asset Notification records what/who/status; it does not send messages.

### Upgrade

Run Alembic `0482_ast_notification_governance`.
