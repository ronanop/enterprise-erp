# Asset RPT Deployment Guide

1. Deploy API with FP-ASSET-018.
2. `alembic upgrade head` → applies `0483_ast_report_governance`.
3. Confirm `asset.report:read` and `asset.report:export` (already seeded historically).
4. Deploy web with `AssetReportsWorkspace` (`/assets/reports`).
5. Smoke: dashboard → run inventory → export CSV → generate → finalize.
