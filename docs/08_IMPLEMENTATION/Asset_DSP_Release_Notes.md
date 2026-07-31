# FP-ASSET-005 — Release Notes

## Summary

Productizes Asset Disposal with workflow governance, eligibility gates, Finance post completion, and a dedicated disposal workspace.

## Highlights

- Create/update with full disposal fields; ADISP document numbers with tenant context
- Cancel draft, reopen rejected, resubmit
- Paginated list with search and filters
- Blocks when open maintenance, open assignment, or pending transfer exists
- One open disposal per asset (app-level)
- Post posts Finance journal then sets asset to `disposed` or `written_off`
- Post is idempotent: optimistic version claim before Finance; already-posted / existing `finance_journal_id` rejected
- Reject audited via `AssetGovernanceService` (single audit path; no duplicate service audit)
- Seeded `asset.disposal:update`
- UI: `/assets/asset-disposals` workspace (replaces generic ResourceListView)

## Breaking changes

- `POST /asset-disposals` requires `asset_id`, `disposal_type` (and related fields); stub `{branch_id,status}` no longer sufficient
- `GET /asset-disposals` returns `AssetDisposalListResult` instead of a bare array / paginate wrapper of all rows
- `PATCH` requires `asset.disposal:update` (previously mapped to `:create`)

## Known limitations

- Open-disposal exclusivity is application-level (no UNIQUE partial index)
- Operators must supply debit/credit account UUIDs for post
- Master asset sync always uses `mark_master_disposed` (status `disposed`) even for write-off of the operational asset
- Post journal amount uses `book_value_at_disposal`, else `proceeds_amount`, else `0` (Planning Package: book value recommended, not mandatory)
- Concurrent post attempts are blocked by optimistic version claim before Finance; a failed claim after a successful journal is not expected when claim precedes Finance
