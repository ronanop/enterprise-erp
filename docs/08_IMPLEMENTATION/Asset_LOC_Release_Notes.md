# Asset Location — Release Notes (FP-ASSET-012)

**Release:** FP-ASSET-012  
**Date:** 2026-07-30

## Added

- Productized asset location management with search, filters, and pagination.
- `POST /asset-locations/{id}/complete` lifecycle action.
- `LocationValidator`, enhanced `LocationService`, `AssetLocationEngine.complete`.
- `AssetLocationWorkspace` UI at `/assets/asset-locations`.
- Migration `0477_ast_location_governance` (current-location index, RBAC grants).

## Fixed

- Router PATCH no longer references non-existent `asset.location:update` permission.

## Unchanged

- Transfer execution location supersede behavior.
- No Workflow, Finance, or Governance integration.
