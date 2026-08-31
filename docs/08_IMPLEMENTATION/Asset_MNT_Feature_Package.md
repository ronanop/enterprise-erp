# FP-ASSET-004 — Asset Maintenance (Work Order) Feature Package

**Status:** Implemented  
**ADR:** ADR-ASSET-MNT-001

## Scope

Governed maintenance work orders: draft → submit → workflow → approved → schedule → start (`in_maintenance`) → complete (`active` when no other open WO) + service history. Open-WO exclusivity, pending-transfer block on start, cancel/reopen/resubmit.

## API (`/api/v1/assets/asset-maintenances`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.maintenance:read` |
| GET | `/{id}` | `asset.maintenance:read` |
| POST | `/` | `asset.maintenance:create` |
| PATCH | `/{id}` | `asset.maintenance:update` |
| POST | `/{id}/submit` | `asset.maintenance:submit` |
| POST | `/{id}/approve` | `asset.maintenance:approve` |
| POST | `/{id}/reject` | `asset.maintenance:approve` |
| POST | `/{id}/cancel` | `asset.maintenance:create` |
| POST | `/{id}/reopen` | `asset.maintenance:create` |
| POST | `/{id}/resubmit` | `asset.maintenance:submit` |
| POST | `/{id}/schedule` | `asset.maintenance:complete` |
| POST | `/{id}/start` | `asset.maintenance:complete` |
| POST | `/{id}/complete` | `asset.maintenance:complete` |

List query: `page`, `page_size`, `company_id`, `asset_id`, `branch_id`, `status`, `maintenance_type`, `q`.

## Workflow

- Code: `AST_MAINTENANCE_APPROVAL` (`entity_name`: `ast_asset_maintenance`)
- Steps (0266): ASSET_EXECUTIVE → ASSET_MANAGER

## UI

- Route: `/assets/asset-maintenances` → `AssetMaintenanceWorkspace`

## Migrations

- `0469_ast_maintenance_governance` — update permission, open WO index, AMNT sequence backfill

## Out of Scope

Plan scheduler, Finance GL for cost, disposal/depreciation productization, barcode tracking.
