# Asset Service History — Deployment Guide (FP-ASSET-013)

## Prerequisites

- Alembic head at `0477_ast_location_governance` or later
- FP-ASSET-005 maintenance work orders deployed

## Steps

1. Deploy API with FP-ASSET-013 code.
2. Run `alembic upgrade head` (applies `0478_ast_service_history_governance`).
3. Deploy web app with `AssetServiceHistoryWorkspace`.
4. Verify maintenance complete still creates history rows.
5. Smoke test manual supplemental POST for completed work order.

## Rollback

- Downgrade `0478` drops indexes only (safe).
- Revert API/web if needed; maintenance auto-history path must be validated after rollback.
