# FP-ASSET-REG-001 — Remediation Report

**Date:** 2026-07-29  
**Trigger:** Enterprise Code Review (REQUIRES CHANGES)

## Mandatory fixes addressed

| # | Issue | Resolution |
|---|--------|------------|
| 1 | Test coverage | Added validator, service lifecycle, sequence concurrency (SQLite), OpenAPI smoke, integration resubmit/WF instance tests |
| 2 | ADR-REG-04 race | `DocumentSequenceRepository` uses `begin_nested()` + `IntegrityError` retry loop; removed `assert` |
| 3 | Frontend category bug | Category select from `/assets/asset-categories`; separate branch UUID; edit draft panel |
| 4 | API contract | `assets-service` documents `AssetListResult`; `normalizeRows` already handles `items`; workspace uses paginated shape |

## Test results (post-remediation)

`31 passed, 2 skipped` — skips: SQLite first-row threaded test, PostgreSQL when `TEST_DATABASE_URL` unset.

## PostgreSQL concurrency

`test_postgres_concurrent_sequence_allocation` runs when `TEST_DATABASE_URL` is set (optional CI).

## Architecture

No ADR or workflow/finance/procurement boundary changes.
