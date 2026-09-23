# Asset Location Master — Phase R0 Revert Report

**Phase:** R0 — Revert previous Organization-backed Location L1  
**Date:** 2026-08-12  
**Status:** Complete

---

## Verdict

**R0 COMPLETE — ORGANIZATION LOCATION RESTORED TO PRE-L1 BEHAVIOR; NO ASSET LOCATION MASTER IMPLEMENTED YET.**

---

## 1. Files reverted / changed

### Organization (restored to committed pre-L1 baseline via `git checkout HEAD`)

| File | Action |
|------|--------|
| `apps/api/src/modules/organization/models/hierarchy.py` | Reverted — removed `is_head_office` ORM column |
| `apps/api/src/modules/organization/domain/entities.py` | Reverted — removed `city`, `is_head_office` from `LocationEntity` |
| `apps/api/src/modules/organization/schemas.py` | Reverted — removed L1 Create/Update/Response extensions |
| `apps/api/src/modules/organization/repository/hierarchy_repository.py` | Reverted — simple list + inline entity mapping only |
| `apps/api/src/modules/organization/service/hierarchy_service.py` | Reverted — `list_locations` + `create_location` only |
| `apps/api/src/modules/organization/routers/hierarchy.py` | Reverted — GET list + POST create only; no GET/PATCH by id |

### Organization tests (L1-only removed)

| File | Action |
|------|--------|
| `apps/api/src/tests/unit/organization/test_org_location_service.py` | **Deleted** (L1-only) |
| `apps/api/src/tests/integration/organization/test_org_routes.py` | Reverted — removed assertions for `/locations/{location_id}` GET/PATCH |

### Migrations

| File | Action |
|------|--------|
| `apps/api/alembic/versions/0495_org_location_head_office.py` | **Retained in history** (was already applied) |
| `apps/api/alembic/versions/0496_revert_org_location_head_office.py` | **Added** — compensating revert migration |

### Asset UI (Organization-backed master removed)

| File | Action |
|------|--------|
| `apps/web/src/components/assets/asset-location-master-workspace.tsx` | **Deleted** |
| `apps/web/src/components/assets/asset-location-master-workspace.test.tsx` | **Deleted** |
| `apps/web/src/components/assets/asset-locations-placeholder-workspace.tsx` | **Added** — temporary R1 placeholder |
| `apps/web/src/app/(app)/assets/[resource]/page.tsx` | `/assets/locations` → placeholder (not org API) |

### Web lib (L1-only helper removed)

| File | Action |
|------|--------|
| `apps/web/src/lib/org-options.ts` | Removed `listBranchOptionsDetailed()`; restored direct `listBranchOptions()` |

**Not changed (explicitly preserved):** Add Asset, `asset-site-catalog.ts`, inventory, transfer, assignment, `/assets/asset-locations`, `ast_asset_location`, existing `listLocationOptions()` for inventory filters, employee directory helpers in `org-options.ts`.

---

## 2. Migration status

| Check | Result |
|-------|--------|
| Alembic head before R0 | `0495_org_location_head_office` (applied) |
| Alembic head after R0 | `0496_revert_org_location_head_office` (applied locally) |
| `0495` applied? | **Yes** — not deleted from history |
| Strategy | Compensating migration `0496` (repository convention: forward-only) |
| `is_head_office` rows before revert | **0** (no Head Office flags set) |

---

## 3. Database state before / after

### Before R0 (post-0495)

- `organization.org_location.is_head_office` — present, all rows `false`
- Indexes: `ux_org_location_company_head_office`, `ux_org_location_company_city_building`
- `organization.org_location.city` — present (pre-existing)

### After R0 (post-0496)

- `is_head_office` column — **removed**
- L1 HO / city+building unique indexes — **removed**
- `city` column — **preserved**
- HQ Campus seed row — **preserved** (`location_name = 'HQ Campus'`)
- Standard org indexes only: `uk_org_location_branch_code`, tenant/company/branch FK indexes

---

## 4. Pre-existing Organization functionality preserved

| Item | Status |
|------|--------|
| `organization.org_location` table | Intact |
| `city` column | Intact |
| HQ Campus seed | Verified present |
| Branch named "Head Office" | Unchanged (org branch, not location HO) |
| `GET /api/v1/locations` | List + `branch_id` filter only |
| `POST /api/v1/locations` | Basic create |
| No `GET/PATCH /locations/{id}` | Confirmed via OpenAPI inspection |

---

## 5. Asset functionality preserved

| Item | Status |
|------|--------|
| `ast_asset_location` / history workflow | Unchanged |
| `/assets/asset-locations` → `AssetLocationWorkspace` | Unchanged |
| `LocationService`, validator, engine, repository | Unchanged |
| Add Asset + `asset-site-catalog.ts` | Unchanged |
| Inventory `listLocationOptions()` | Unchanged (reads org list for filter labels — pre-existing) |
| Configuration → Locations nav (`/assets/locations`) | **Placeholder only** — no org master CRUD |

---

## 6. Cross-module dependency verification

Searched: `org_location`, `is_head_office`, `organization.location`

| Module | Impact from R0 |
|--------|----------------|
| Organization | Restored pre-L1 API/model |
| Master Data (`master_asset.location_id` → org_location) | **No change** — FK intact |
| Warehouse (`warehouse.location_id` → org_location) | **No change** |
| HRMS / CRM / Finance / Procurement / SCM | No `is_head_office` or L1 org location usage found |
| Asset location history | Uses `org_location_id` UUID optionally — unchanged |
| Asset transfer validator | `AssetOrganizationAdapter.get_location` — unchanged |

**No cross-module breakage identified.** Remaining `is_head_office` references exist only in migration files `0495` / `0496` (historical record).

---

## 7. Tests executed

### Backend

```text
pytest src/tests/integration/organization/test_org_routes.py \
       src/tests/integration/asset/test_asset_location_workflow.py \
       src/tests/unit/asset/test_location_service.py \
       src/tests/unit/asset/test_location_validator.py \
       src/tests/unit/asset/test_location_engine.py
```

**Result:** 36 passed

### Frontend

```text
npm test -- --run \
  src/components/assets/assets-module-sidebar.test.tsx \
  src/components/assets/asset-add-form.test.tsx
```

**Result:** 18 passed

---

## 8. Failures

None.

---

## 9. Temporary Asset Locations route behavior

- **Route:** `/assets/locations` (Configuration → Locations in Asset sidebar)
- **Component:** `AssetLocationsPlaceholderWorkspace`
- **Behavior:** Informational card explaining Asset Location Master arrives in Phase R1
- **Does not call:** Organization `/locations` for CRUD
- **Nav slot preserved:** Yes — sidebar link unchanged in `assets.ts`

---

## 10. R1 not implemented

Confirmed **not** added in R0:

- Asset Location Master table
- Asset Location Master API / CRUD
- Head Office logic in Asset scope
- Add Asset integration
- Inventory / transfer / Excel integration

---

## Rollback note for other environments

If another database is at `0495` but not yet at `0496`, run:

```bash
cd apps/api && .venv/bin/alembic upgrade head
```

This applies `0496_revert_org_location_head_office` safely (no `is_head_office` data was found in local dev).

---

## Related docs

- Previous (superseded) L1 report: `docs/ASSET_LOCATION_MASTER_L1_IMPLEMENTATION.md` — documents Organization Option A; **do not follow for new work**
- Architecture inspection: Asset-only boundary locked for R1+
