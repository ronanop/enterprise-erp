# FP-ASSET-006 — Release Notes

## Summary

Productizes Asset Depreciation with real SL/WDV/UoP calculation, period batch generation, Finance post with idempotency, book-value sync, and a dedicated workspace.

## Breaking changes

- Create requires asset/period/method fields
- List returns `AssetDepreciationListResult`
- PATCH requires `asset.depreciation:update`

## Reverse (remediation)

- Optimistic version claim before Finance prevents duplicate reverse journals
- Already-reversed rows are rejected
- Operators supply original post account orientation (Dr expense / Cr accumulated); the service swaps accounts for the reversing journal without changing the Finance adapter
- Workspace documents account orientation; Asset History and Batch Status use existing list filters

## Known limitations

- No approval workflow (by ERD design)
- Scheduler never auto-posts; requires tenant/company/user kwargs or skips
- Operators supply GL account UUIDs
- Period exclusivity is application-level (UK includes idempotency_key)
- Finance period-close soft gate not implemented (DEP-05 optional)
- Reversing journal line descriptions remain adapter defaults (adapter unchanged)
