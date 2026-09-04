# FP-ASSET-015 — Asset Meter Reading (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-MTR-001

## Scope

Append-only usage meter readings per asset. Lifecycle: recorded → void. No approval workflow. No Finance.

## Lifecycle fidelity

- **Record:** `POST /` — creates `recorded` row; client cannot override `status`.
- **Void:** `POST /{id}/void` — recorded only; immutable business fields.
- No PATCH endpoint.

## API (`/api/v1/assets/meter-readings`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.meter:read` |
| GET | `/{id}` | `asset.meter:read` |
| POST | `/` | `asset.meter:create` |
| POST | `/{id}/void` | `asset.meter:update` |

List: `page`, `page_size`, `company_id`, `asset_id`, `meter_type`, `branch_id`, `status`, `reading_from`, `reading_to`, `q`.

## UI

`AssetMeterReadingWorkspace` at `/assets/meter-readings`. Server-side search, latest-reading hint on create, void action.
