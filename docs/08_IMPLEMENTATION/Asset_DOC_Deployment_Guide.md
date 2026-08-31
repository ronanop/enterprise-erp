# Asset Document Management — Deployment Guide (FP-ASSET-016)

1. Deploy API with FP-ASSET-016 code.
2. Run `alembic upgrade head` (applies `0481_ast_document_governance`).
3. Deploy web app with `AssetDocumentWorkspace` and `asset-documents` nav entry.
4. Confirm RBAC roles include `asset.document:read`, `:create`, `:update`.
5. Smoke-test: create document with `https://` URI → supersede → archive.

## Rollback

1. Revert web/API deploy.
2. `alembic downgrade 0480_ast_meter_reading_governance` drops search indexes only (data retained).
