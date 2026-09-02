# FP-ASSET-011 — Asset Maintenance Plan (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-MPL-001

## Scope

Maintenance plan lifecycle: draft → activate → pause ↔ resume → close. No approval workflow. No Finance.

## API (`/api/v1/assets/maintenance-plans`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.maintenance_plan:read` |
| GET | `/{id}` | `asset.maintenance_plan:read` |
| POST | `/` | `asset.maintenance_plan:create` |
| PATCH | `/{id}` | `asset.maintenance_plan:update` |
| POST | `/{id}/activate` | `asset.maintenance_plan:activate` |
| POST | `/{id}/pause` | `asset.maintenance_plan:pause` |
| POST | `/{id}/resume` | `asset.maintenance_plan:resume` |
| POST | `/{id}/close` | `asset.maintenance_plan:close` |

List: `page`, `page_size`, `company_id`, `asset_id`, `maintenance_type`, `status`, `next_due_date`, `branch_id`, `q`.

## UI

`AssetMaintenancePlanWorkspace` at `/assets/maintenance-plans`.
