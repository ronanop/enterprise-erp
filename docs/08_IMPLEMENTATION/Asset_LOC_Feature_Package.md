# FP-ASSET-012 — Asset Location Management (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-LOC-001

## Scope

Location lifecycle: create (active, current) → update metadata → complete (historical). No approval workflow. No Finance.

## API (`/api/v1/assets/asset-locations`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.location:read` |
| GET | `/{id}` | `asset.location:read` |
| POST | `/` | `asset.location:create` |
| PATCH | `/{id}` | `asset.location:create` |
| POST | `/{id}/complete` | `asset.location:complete` |

List: `page`, `page_size`, `company_id`, `asset_id`, `status`, `is_current`, `branch_id`, `q`.

## UI

`AssetLocationWorkspace` at `/assets/asset-locations`.

## Transfer integration

`TransferService` continues to use `AssetLocationRepository.find_current()` and `AssetLocationEngine.mark_historical()` on transfer completion without changes.
