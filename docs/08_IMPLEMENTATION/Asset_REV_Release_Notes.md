# FP-ASSET-007 — Release Notes

## Summary

Productizes Asset Revaluation with validator gates, workflow cancel/reopen/resubmit, Finance claim-before-post, book-value sync on post, search/pagination, `:update` permission, and `AssetRevaluationWorkspace`.

## Breaking changes

- Create requires `asset_id`, `new_book_value`, `reason` (and `branch_id`)
- List returns `AssetRevaluationListResult` (paginated)
- PATCH requires `asset.revaluation:update`
- **Submit requires `revaluation_date`** (create/draft save may omit it; set date before submit)

## Remediation notes

- Submit blocked without `revaluation_date` (API + workspace)
- Workspace SoD helper when creator cannot approve/reject
- Submit audit: recorded by `AssetGovernanceService.submit_for_approval` (`operation="submit"`); service does not duplicate that audit

## Known limitations

- Operators supply GL account UUIDs (increase vs decrease orientation is operator-driven)
- Open-revaluation exclusivity is application-level
- No hard coupling to pending depreciation periods
- No reporting/dashboards in this package
- When workflow governance is disabled, submit has no governance audit path (legacy/dev only)
