# CR-004 Phase 3.3B — Asset Operations Dashboard (Live Data)

**Status:** Complete  
**Date:** 2026-08-03  

---

## Architecture

```text
AssetOperationsContainer (data)
        ↓
dashboard.mapper.ts (DTO → UI models)
        ↓
AssetOperationsDashboard (presentational)
```

- **Fetch orchestration:** `asset-operations-fetch.ts` — `Promise.all` parallel reads.
- **API client:** `assetOperationsService` in `assets-service.ts`.

---

## API mapping

| UI region | Endpoint | Query |
|-----------|----------|--------|
| KPI row | `GET /api/v1/assets/assets/dashboard-summary` | `branch_id` when branch ≠ All |
| Ready queue | `GET /api/v1/assets/assets` | `operational_status=READY_TO_MOVE`, `page_size=10`, `branch_id` |
| Pending disposal | `GET /api/v1/assets/assets` | `operational_status=PENDING_DISPOSAL`, `page_size=10`, `branch_id` |
| Recent assignments | `GET /api/v1/assets/asset-assignments` | `page_size=10`, `branch_id` |
| Branch list | `GET /branches` | via `listBranchOptions()` |

Sort order for lists follows API defaults (`created_at` desc).

---

## States

| State | Behavior |
|-------|----------|
| Loading | StatCard + QueueCard skeletons |
| Empty queues | Custom EmptyState titles (no ready / no pending / no assignments) |
| Partial errors | KPI banner or per-queue empty + error description |
| Total failure | Retry card; page does not crash |

---

## Route

`/assets` → `AssetOperationsContainer` (replaces legacy `AssetsDashboard`).

---

## Tests

`npm run test` in `apps/web` — mapper, fetch, container, dashboard, shared components.

---

## Out of scope

Sidebar, inventory routes, quick-action navigation, new backend APIs.
