# FP-ASSET-005 — Disposal Deployment Guide

## Prerequisites

- Alembic head includes `0469_ast_maintenance_governance` (or earlier heads applied in order)
- `AST_DISPOSAL_APPROVAL` workflow seeded (migration `0266`)
- `ASSET_WORKFLOW_GOVERNANCE_ENABLED=true` in production

## Steps

1. Deploy API with FP-ASSET-005 code.
2. Run Alembic upgrade to `0470_ast_disposal_governance`.
3. Confirm `asset.disposal:update` exists and is granted to ASSET_MANAGER / ASSET_ADMIN (and role specs).
4. Confirm partial index `ix_ast_asset_disposal_asset_status_open` exists.
5. Deploy web app with `AssetDisposalWorkspace` at `/assets/asset-disposals`.
6. Smoke: create draft → submit → multi-step approve (SoD) → post with account UUIDs → asset status `disposed` or `written_off`.

## Post-deploy checks

- List returns `{ items, total, page, page_size }`.
- Open maintenance / active assignment / pending transfer block create/submit/post.
- Creator cannot approve own disposal.
- Approve does not change asset status; post does.

## Rollback

Prefer forward-fix. Downgrade `0470` removes permission grants and the open index only (does not delete disposal rows).
