# FP-ASSET-010 — Asset Insurance (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-INS-001

## Scope

Insurance policy lifecycle: draft → activate → renew → expire → close (cancelled). No approval workflow. No Finance.

## Lifecycle fidelity

Coverage duration changes on an **active** policy require **Renew** (`POST /{id}/renew`).  
PATCH cannot change `end_date` while status is `active`. Draft remains fully editable.

## API (`/api/v1/assets/asset-insurances`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.insurance:read` |
| GET | `/{id}` | `asset.insurance:read` |
| POST | `/` | `asset.insurance:create` |
| PATCH | `/{id}` | `asset.insurance:update` |
| POST | `/{id}/activate` | `asset.insurance:activate` |
| POST | `/{id}/renew` | `asset.insurance:renew` |
| POST | `/{id}/expire` | `asset.insurance:expire` |
| POST | `/{id}/close` | `asset.insurance:close` |

List: `page`, `page_size`, `company_id`, `asset_id`, `vendor_id`, `status`, `expiry_date`, `q`.

Renew body: `{ "new_end_date": "YYYY-MM-DD" }`.

## UI

`AssetInsuranceWorkspace` at `/assets/asset-insurances`.
