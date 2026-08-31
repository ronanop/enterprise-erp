# FP-ASSET-002 — Asset Transfer Feature Package

**Status:** Implemented (remediation complete)  
**ADR:** ADR-ASSET-TRF-001

## Scope

Governed transfer of fixed assets: draft document, workflow approval, execution updates `ast_asset`, location history, optional master sync, audit and notifications via `AssetGovernanceService`.

## API (`/api/v1/assets/asset-transfers`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.transfer:read` |
| GET | `/{id}` | `asset.transfer:read` |
| POST | `/` | `asset.transfer:create` |
| PATCH | `/{id}` | `asset.transfer:update` |
| POST | `/{id}/submit` | `asset.transfer:submit` |
| POST | `/{id}/approve` | `asset.transfer:approve` |
| POST | `/{id}/reject` | `asset.transfer:approve` |
| POST | `/{id}/cancel` | `asset.transfer:create` |
| POST | `/{id}/reopen` | `asset.transfer:create` |
| POST | `/{id}/resubmit` | `asset.transfer:submit` |

List query: `page`, `page_size`, `company_id`, `asset_id`, `branch_id`, `status`, `q`, `effective_from`, `effective_to`.

**Removed:** `POST /{id}/complete`, permission `asset.transfer:complete`.

## Workflow

- Code: `AST_TRANSFER_APPROVAL` (`entity_name`: `ast_asset_transfer`)
- Steps (0466 seed): ASSET_EXECUTIVE → ASSET_MANAGER → ASSET_ADMIN

## UI

- Route: `/assets/asset-transfers` → `AssetTransferWorkspace`
- Workflow-aware approve/reject; creator cannot approve (UI hint + API SoD)

## Migrations

- `0466_ast_transfer_governance` — columns, workflow, permissions
- `0467_ast_transfer_pending_index` — partial index on pending transfers

## Tests

- Unit: engine, validator, service, concurrency
- Integration: `test_asset_transfer_workflow.py`
- Security: SoD + workflow instance requirements
