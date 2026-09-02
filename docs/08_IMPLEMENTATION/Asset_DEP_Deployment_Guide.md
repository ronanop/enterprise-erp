# FP-ASSET-006 — Deployment Guide

1. Deploy API with FP-ASSET-006.
2. Alembic upgrade to `0471_ast_depreciation_governance`.
3. Confirm `asset.depreciation:update` granted.
4. Deploy web workspace at `/assets/asset-depreciations`.
5. Smoke: generate-run → calculate → post (account UUIDs) → verify `current_book_value`.
6. Optional: enable Celery beat for `asset.depreciation_scheduler` (drafts only).

## Scheduler (`asset.depreciation_scheduler`)

- Creates **draft** depreciation rows only for the given period.
- Never calculates amounts and never posts/reverses Finance journals.
- Requires kwargs: `tenant_id`, `company_id`, `user_id` (UUID strings). Without them the task returns `status=skipped`.
- Optional: `period_year`, `period_month` (defaults to current calendar month).

## Reverse account orientation

- Enter the **same** accounts used at post: Debit = depreciation expense, Credit = accumulated depreciation.
- The service swaps accounts before calling the Finance adapter so the reversing journal is Dr Accumulated / Cr Expense.
- Concurrent reverse attempts are blocked by optimistic version claim before Finance.

## Audit note

- `generate_run` audit `entity_id` is the `depreciation_batch_id` correlation UUID (not a depreciation row PK).

Rollback: prefer forward-fix; downgrade drops permission/index only.
