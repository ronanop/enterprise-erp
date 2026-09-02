# FP-ASSET-003 — Asset Assignment (Allocation) Feature Package

**Status:** Implemented  
**ADR:** ADR-ASSET-ASN-001

## Scope

Governed asset allocation: draft → submit → workflow → activate (custody) → optional return. Shared/exclusive rules, pending-transfer block, master custodian/branch sync, cancel/reopen/resubmit.

## API (`/api/v1/assets/asset-assignments`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.assignment:read` |
| GET | `/{id}` | `asset.assignment:read` |
| POST | `/` | `asset.assignment:create` |
| PATCH | `/{id}` | `asset.assignment:update` |
| POST | `/{id}/submit` | `asset.assignment:submit` |
| POST | `/{id}/approve` | `asset.assignment:approve` |
| POST | `/{id}/reject` | `asset.assignment:approve` |
| POST | `/{id}/cancel` | `asset.assignment:create` |
| POST | `/{id}/reopen` | `asset.assignment:create` |
| POST | `/{id}/resubmit` | `asset.assignment:submit` |
| POST | `/{id}/return` | `asset.assignment:return` |

List query: `page`, `page_size`, `company_id`, `asset_id`, `branch_id`, `status`, `allocation_type`, `q`.

## Workflow

- Code: `AST_ASSIGNMENT_APPROVAL` (`entity_name`: `ast_asset_assignment`)
- Steps (0266): ASSET_EXECUTIVE → ASSET_MANAGER → ASSET_MANAGER

## UI

- Route: `/assets/asset-assignments` → `AssetAssignmentWorkspace`

## Migrations

- `0468_ast_assignment_governance` — update permission, pending/active index, AASN sequence backfill

## Tests

- Unit: engine, validator, service
- Integration: `test_asset_assignment_workflow.py`
- Security: SoD + workflow instance
- OpenAPI route registration
