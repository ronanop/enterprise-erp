# Asset NTF Feature Package (FP-ASSET-017)

## Summary

Productizes `ast_asset_notification` as an enterprise **metadata registry** for asset alerts. Foundation Notification remains the sole delivery platform.

## Architecture

```text
Router → AssetNotificationService → NotificationValidator → AssetNotificationEngine → AssetNotificationRepository
```

## APIs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/assets/asset-notifications` | `asset.notification:read` |
| GET | `/assets/asset-notifications/{id}` | `asset.notification:read` |
| POST | `/assets/asset-notifications` | `asset.notification:create` |
| PATCH | `/assets/asset-notifications/{id}` | `asset.notification:update` |
| POST | `.../archive` | `asset.notification:update` |
| POST | `.../mark-read` | `asset.notification:update` |
| POST | `.../mark-sent` | `asset.notification:update` |
| POST | `.../mark-failed` | `asset.notification:update` |

## Frontend

`AssetNotificationWorkspace` at `/assets/asset-notifications` — search, filters, pagination, badges, detail/metadata viewer, archive, mark read. No composer.

## Migration

`0482_ast_notification_governance` — indexes + RBAC seeds.

## Tests

Unit (validator, engine, service, concurrency) + integration (routes, workflow/regression). Target 25–30+.
