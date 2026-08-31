# FP-ASSET-008 — Asset Audit (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-AUD-001

## Scope

Physical verification: planned → start → complete (or cancel). Capture `found_status` variance. No approval workflow. No Finance.

## API (`/api/v1/assets/asset-audits`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.audit:read` |
| GET | `/{id}` | `asset.audit:read` |
| POST | `/` | `asset.audit:create` |
| PATCH | `/{id}` | `asset.audit:update` |
| POST | `/{id}/start` | `asset.audit:update` |
| POST | `/{id}/complete` | `asset.audit:complete` |
| POST | `/{id}/cancel` | `asset.audit:create` |

List: `page`, `page_size`, `company_id`, `asset_id`, `auditor_employee_id`, `status`, `found_status`, `q`.

## UI

`AssetAuditWorkspace` at `/assets/asset-audits`.
