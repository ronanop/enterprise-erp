# Asset Assignment — Release Notes (FP-ASSET-003)

## Added

- Full assignment API (allocation fields, cancel/reopen/resubmit, activate custody, return)
- Server-side search, filters, pagination on assignment list
- Shared / exclusive assignment rules; pending-transfer conflict check
- Assignment workspace at `/assets/asset-assignments`
- Permission `asset.assignment:update`
- Migration `0468_ast_assignment_governance`

## Breaking

- `POST /asset-assignments` requires `asset_id`, `allocation_type`, and type-specific targets
- List response shape: `{ items, total, page, page_size }` instead of bare array
- `PATCH` requires `asset.assignment:update` and `version`

## Unchanged

- `POST /{id}/return`
- Workflow code `AST_ASSIGNMENT_APPROVAL`
- Governance feature flag behaviour
