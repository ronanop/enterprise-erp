# FP-ASSET-013 — Asset Service History (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-SVH-001

## Scope

Append-only maintenance service log. Auto-recorded on work order complete. Manual supplemental POST allowed. Immutable after creation.

## API (`/api/v1/assets/service-histories`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.maintenance:read` |
| GET | `/{id}` | `asset.maintenance:read` |
| POST | `/` | `asset.maintenance:create` |

List: `page`, `page_size`, `company_id`, `asset_id`, `maintenance_id`, `branch_id`, `serviced_from`, `serviced_to`, `q`.

## UI

`AssetServiceHistoryWorkspace` at `/assets/service-histories`.

## Maintenance integration

`MaintenanceService.complete()` delegates to `ServiceHistoryService.record_from_maintenance()`.
