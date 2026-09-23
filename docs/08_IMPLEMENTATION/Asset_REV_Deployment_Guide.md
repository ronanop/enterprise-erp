# FP-ASSET-007 — Deployment Guide

1. Deploy API with FP-ASSET-007.
2. Alembic upgrade to `0472_ast_revaluation_governance`.
3. Confirm `asset.revaluation:update` granted to ASSET roles.
4. Confirm `AST_REVALUATION_APPROVAL` workflow seed (0266) is present.
5. Deploy web workspace at `/assets/asset-revaluations`.
6. Smoke:
   - Create draft (date optional) → set/save `revaluation_date` → Submit
   - Approve as a different user (SoD; creator sees helper text)
   - Post with account UUIDs → verify `current_book_value`
7. Audit: submit is logged by governance (`operation="submit"`); do not expect a second service-layer submit audit.

Rollback: prefer forward-fix; downgrade drops permission/index only.
