# Asset Service History — Release Notes (FP-ASSET-013)

**Release:** FP-ASSET-013  
**Date:** 2026-07-30

## Added

- Productized append-only service history with search, filters, pagination.
- `ServiceHistoryValidator`, `ServiceHistoryService.record_from_maintenance()`.
- `AssetServiceHistoryWorkspace` at `/assets/service-histories`.
- Migration `0478_ast_service_history_governance` (search indexes).

## Changed

- GET list returns `ServiceHistoryListResult` (paginated object).
- `MaintenanceService.complete()` delegates to `record_from_maintenance()`.

## Removed

- PATCH `/service-histories/{id}` (immutable log per SVH-08).

## Unchanged

- No Workflow, Finance, or new RBAC resource.
- Auto-history on maintenance complete preserved.
