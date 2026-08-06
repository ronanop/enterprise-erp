# CR-004 Phase 2C — Read API Exposure

**Date:** 2026-08-03  
**Scope:** Read-only APIs for `operational_status` filtering and dashboard counts. No transitions, no workflow changes.

---

## APIs

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/v1/assets/assets` | `asset.asset:read` | Existing list; new query `operational_status` |
| `GET` | `/api/v1/assets/assets/dashboard-summary` | `asset.asset:read` | Operational status bucket counts |

### List filter

`operational_status` — one of `READY_TO_MOVE`, `ASSIGNED`, `RETIRED`, `PENDING_DISPOSAL`, `DISPOSED` (case-insensitive). Invalid values → `422`.

### Dashboard summary

Response fields: `total_assets`, `ready_to_move`, `assigned`, `retired`, `pending_disposal`, `disposed`, `company_id`, optional `branch_id`, `by_branch[]` (company scope only).

Query: optional `company_id`, `branch_id` (tenant + scope validators unchanged).

---

## Schema

`AssetResponse.operational_status` — read-only (ORM mapped).

---

## Layers

| Layer | Responsibility |
|-------|----------------|
| Router | Thin; RBAC `asset.asset:read` |
| `AssetService` | Filter coercion via `coerce_operational_status_filter` |
| `AssetDashboardSummaryService` | DTO assembly |
| `AssetRepository` | `search` filter, `count_by_operational_status`, `dashboard_summary`, `summary_by_branch` |

---

## Tests

```bash
cd apps/api
pytest src/tests/unit/asset/test_asset_operational_status_read_api.py \
  src/tests/unit/asset/test_asset_repository_dashboard_summary.py -q
```

---

## Out of scope

PATCH/POST transitions, frontend, sidebar, reports, workflow changes.
