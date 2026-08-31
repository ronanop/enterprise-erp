# FP-ASSET-002 — Remediation Report

**Date:** 2026-07-29  
**Review:** Enterprise Code Review (APPROVED WITH REMEDIATION)

## Must items

| # | Item | Status |
|---|------|--------|
| 1 | ADR-ASSET-TRF-001 + Feature Package under `docs/` | Done |
| 2 | Alembic upgrade/downgrade documented | Done (`Asset_TRF_Deployment_Guide.md`) |
| 3 | Migration downgrade restores `asset.transfer:complete` | Done (0466 downgrade) |
| 4 | Production governance + legacy path documented | Done |
| 5 | CI validation | See validation section in release notes below |

## Should items

| Item | Status |
|------|--------|
| `effective_date` drives `transferred_at` / location `effective_from` | Done |
| Master sync `location_id` when `to_org_location_id` set | Done |
| API `effective_from` / `effective_to` filters | Done |
| `validate_execute_readiness` | Done |
| Workflow-aware frontend + hide approve for creator | Done |
| Remove `engine.complete` / `cancel` | Done |
| Security test: approve requires workflow instance | Done |

## Could items

| Item | Status |
|------|--------|
| Pending-transfer partial index | Done (`0467`) |
| `org_location` validation | Done (adapter + validator) |

## Deferred

- Rich org/master pickers in UI (UUID inputs remain; parity with registration workspace).
- Automated PostgreSQL migration test in CI (run manually until pipeline job exists).
