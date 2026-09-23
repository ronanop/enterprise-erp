# Asset Checklist — Release Notes (FP-ASSET-014)

**Release:** FP-ASSET-014  
**Date:** 2026-07-30

## Added

- Productized checklist management with validator, engine, search, filters, pagination.
- `ChecklistValidator`, `AssetChecklistEngine`, `ChecklistService`.
- `AssetChecklistWorkspace` at `/assets/asset-checklists`.
- Migration `0479_ast_checklist_governance` (search indexes + code uniqueness).

## Changed

- GET list returns `AssetChecklistListResult` (paginated object) instead of bare array.
- Complete/cancel exposed as dedicated POST actions with optimistic locking.

## Unchanged

- No Workflow, Finance, or Governance integration.
- RBAC permissions unchanged (`asset.checklist:read`, `:create`, `:update`).
- Maintenance and audit modules unaffected.
