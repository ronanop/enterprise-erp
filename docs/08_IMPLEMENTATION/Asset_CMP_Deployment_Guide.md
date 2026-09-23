# Asset CMP — Deployment Guide

## Prerequisites

- Architecture Lock v1.1
- Asset registration (FP-ASSET-REG) available
- Alembic head at or after `0483_ast_report_governance`

## Steps

1. Deploy API build containing FP-ASSET-019.
2. Run migrations: `alembic upgrade head` (applies `0484_ast_component_governance`).
3. Confirm permissions `asset.component:read|create|update` exist and are granted to ASSET_* roles.
4. Deploy web build with `AssetComponentsWorkspace`.
5. Smoke: install → tree → replace → history → dispose.

## Rollback

1. Roll back web if needed.
2. `alembic downgrade 0483_ast_report_governance` only if no production replace history depends on partial UK semantics.
3. Prefer feature flag / RBAC revoke over destructive schema rollback when history rows exist.
