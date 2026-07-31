# FP-ASSET-010 — Deployment Guide

## Prerequisites

- Alembic head at or after `0474_ast_warranty_governance`
- Asset module roles present (`ASSET_MANAGER`, `ASSET_EXECUTIVE`, `ASSET_ADMIN`)

## Steps

1. Deploy API with FP-ASSET-010 code.
2. Run Alembic upgrade to `0475_ast_insurance_governance`.
3. Deploy web app (includes `AssetInsuranceWorkspace`).
4. Verify `/assets/asset-insurances` loads for users with `asset.insurance:read`.
5. Smoke: create draft → activate → renew → expire → close.

## Rollback

1. Downgrade Alembic to `0474_ast_warranty_governance` only if no `draft`/`renewed` rows remain.
2. Redeploy prior API/web builds.
