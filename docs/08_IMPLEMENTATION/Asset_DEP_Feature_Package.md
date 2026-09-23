# FP-ASSET-006 — Asset Depreciation Feature Package

**Status:** Implemented  
**ADR:** ADR-ASSET-DEP-001

## Scope

Period depreciation: draft → calculate → post (Finance) → optional reverse. Batch period generation. No approval workflow.

## API (`/api/v1/assets/asset-depreciations`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.depreciation:read` |
| GET | `/{id}` | `asset.depreciation:read` |
| POST | `/` | `asset.depreciation:calculate` |
| PATCH | `/{id}` | `asset.depreciation:update` |
| POST | `/generate-run` | `asset.depreciation:calculate` |
| POST | `/{id}/calculate` | `asset.depreciation:calculate` |
| POST | `/{id}/post` | `asset.depreciation:post` |
| POST | `/{id}/reverse` | `asset.depreciation:post` |

List filters: `status`, `method`, `period_year`, `period_month`, `asset_id`, `depreciation_batch_id`, `q`.

## Lifecycle

`draft` → `calculated` → `posted` → `reversed` | `failed`

## UI

`/assets/asset-depreciations` → `AssetDepreciationWorkspace`

## Migration

`0471_ast_depreciation_governance`
