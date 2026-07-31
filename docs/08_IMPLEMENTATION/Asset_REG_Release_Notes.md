# Asset Registration — Release Notes (FP-ASSET-REG-001)

## Added

- Full registration API contract (create/update with mandatory fields on submit)
- Cancel, reopen, resubmit lifecycle
- Server-side search, filters, pagination on asset list
- GRN prefill endpoint (read-only procurement)
- Atomic asset numbering `AST-YYYY-NNNNNN`
- Asset registration UI at `/assets/assets`

## Breaking

- `POST /assets` body now requires registration fields (Pydantic validation)
- List response shape: `{ items, total, page, page_size }` instead of bare array

## Unchanged

- Workflow governance flag and multi-step approve when enabled
