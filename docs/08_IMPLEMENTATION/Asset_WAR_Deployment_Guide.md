# FP-ASSET-009 — Deployment Guide

## Prerequisites

- Alembic head at or after `0473_ast_audit_governance`
- Asset module roles present (`ASSET_MANAGER`, `ASSET_EXECUTIVE`, `ASSET_ADMIN`)

## Steps

1. Deploy API with FP-ASSET-009 code.
2. Run Alembic upgrade to `0474_ast_warranty_governance`.
3. Deploy web app (includes `AssetWarrantyWorkspace`).
4. Verify `/assets/asset-warranties` loads for users with `asset.warranty:read`.
5. Smoke: create draft → activate → extend → expire.

## Rollback

1. Downgrade Alembic to `0473_ast_audit_governance` only if no `draft`/`extended` rows remain (constraint restore).
2. Redeploy prior API/web builds.
