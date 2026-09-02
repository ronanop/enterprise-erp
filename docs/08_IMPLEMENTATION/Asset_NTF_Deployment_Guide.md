# Asset NTF Deployment Guide

## Prerequisites

- Alembic head at or after `0481_ast_document_governance`
- Foundation Notification module deployed (unchanged)

## Steps

1. Deploy API with FP-ASSET-017 code.
2. Run migration: `alembic upgrade head` (applies `0482_ast_notification_governance`).
3. Confirm permissions `asset.notification:read|create|update` exist and are granted to ASSET_* roles.
4. Deploy web app with `AssetNotificationWorkspace`.
5. Smoke-test: create metadata row → mark-sent → mark-read → archive.

## Notes

- No Celery worker changes.
- No Foundation Notification template changes required for Phase 1.
- No table recreate; indexes + seeds only.
