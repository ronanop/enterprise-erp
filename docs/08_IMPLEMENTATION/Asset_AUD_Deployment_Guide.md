# FP-ASSET-008 — Deployment Guide

1. Deploy API with FP-ASSET-008.
2. Alembic upgrade to `0473_ast_audit_governance`.
3. Confirm `asset.audit:update` granted.
4. Deploy web workspace at `/assets/asset-audits`.
5. Smoke: create planned (asset + auditor) → set date + found_status → start → complete.

Rollback: prefer forward-fix; downgrade drops permission/index only.
