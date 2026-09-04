# FP-ASSET-019 — Asset Components (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-COMPONENT-001

## Scope

Option B lightweight child components under a parent asset. Depth 1 only. No inventory behavior.

## Lifecycle fidelity

- **Install:** `POST /` — creates `active`; client cannot override `status`.
- **Update:** `PATCH /{id}` — active only; `asset_id` / `component_code` immutable; requires `version`.
- **Replace:** `POST /{id}/replace` — marks source `replaced`, creates successor `active` (same code allowed via partial UK).
- **Dispose:** `POST /{id}/dispose` — active → `disposed` (terminal).

## API (`/api/v1/assets/asset-components`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.component:read` |
| GET | `/tree?asset_id=` | `asset.component:read` |
| GET | `/{id}` | `asset.component:read` |
| GET | `/{id}/history` | `asset.component:read` |
| POST | `/` | `asset.component:create` |
| PATCH | `/{id}` | `asset.component:update` |
| POST | `/{id}/replace` | `asset.component:update` |
| POST | `/{id}/dispose` | `asset.component:update` |

List: `page`, `page_size`, `company_id`, `asset_id`, `status`, `product_id`, `branch_id`, `q`, `sort`.

## UI

`AssetComponentsWorkspace` at `/assets/asset-components`. Asset selector, list, hierarchy panel, history timeline, install / replace / dispose.
