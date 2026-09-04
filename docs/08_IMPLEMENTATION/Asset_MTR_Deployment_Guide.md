# Asset Meter Reading — Deployment Guide (FP-ASSET-015)

## Prerequisites

- Alembic head at `0479_ast_checklist_governance` or later
- FP-ASSET-REG-001 asset registration deployed

## Steps

1. Deploy API with FP-ASSET-015 code.
2. Run `alembic upgrade head` (applies `0480_ast_meter_reading_governance`).
3. Deploy web app with `AssetMeterReadingWorkspace`.
4. Verify RBAC roles include `asset.meter:read`, `:create`, `:update` (already seeded).
5. Smoke test: record reading, verify non-decreasing rule, void reading.

## Rollback

- Downgrade `0480` drops indexes only (safe).
- Revert API/web if needed.
