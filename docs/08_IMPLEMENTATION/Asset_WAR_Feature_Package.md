# FP-ASSET-009 — Asset Warranty (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-WAR-001

## Scope

Warranty coverage lifecycle: draft → activate → extend → expire. No approval workflow. No Finance.

## Lifecycle fidelity

Coverage duration changes on an **active** warranty require **Extend** (`POST /{id}/extend`).  
PATCH cannot lengthen (or otherwise change) `end_date` while status is `active`. Draft remains fully editable.

## API (`/api/v1/assets/asset-warranties`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.warranty:read` |
| GET | `/{id}` | `asset.warranty:read` |
| POST | `/` | `asset.warranty:create` |
| PATCH | `/{id}` | `asset.warranty:update` |
| POST | `/{id}/activate` | `asset.warranty:activate` |
| POST | `/{id}/extend` | `asset.warranty:extend` |
| POST | `/{id}/expire` | `asset.warranty:expire` |

List: `page`, `page_size`, `company_id`, `asset_id`, `vendor_id`, `warranty_type`, `status`, `expiry_date`, `q`.

Extend body: `{ "new_end_date": "YYYY-MM-DD" }`.

## UI

`AssetWarrantyWorkspace` at `/assets/asset-warranties`. Active end-date field is disabled; Extend action collects `new_end_date`.
