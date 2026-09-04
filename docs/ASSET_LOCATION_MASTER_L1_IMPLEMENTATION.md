# Asset Location Master — L1 Implementation Report

**Phase:** L1 — Location Master Foundation (Option A)  
**Date:** 2026-08-12  
**Status:** Complete — L2 not started

---

## 1. Files changed

### Backend
| File | Change |
|------|--------|
| `apps/api/alembic/versions/0495_org_location_head_office.py` | **New** migration |
| `apps/api/src/modules/organization/models/hierarchy.py` | `is_head_office` column on `OrgLocation` |
| `apps/api/src/modules/organization/domain/entities.py` | `LocationEntity` + `city`, `is_head_office` |
| `apps/api/src/modules/organization/schemas.py` | Create/Update/Response schemas |
| `apps/api/src/modules/organization/repository/hierarchy_repository.py` | List filters, get, create/update, HO helpers, city+building duplicate lookup |
| `apps/api/src/modules/organization/service/hierarchy_service.py` | Validation, HO rule, replace HO, IntegrityError mapping |
| `apps/api/src/modules/organization/routers/hierarchy.py` | List filters, GET/PATCH by id |
| `apps/api/src/tests/unit/organization/test_org_location_service.py` | **New** unit tests |
| `apps/api/src/tests/integration/organization/test_org_routes.py` | Assert GET/PATCH location routes |

### Frontend
| File | Change |
|------|--------|
| `apps/web/src/components/assets/asset-location-master-workspace.tsx` | **New** Location Master admin UI |
| `apps/web/src/components/assets/asset-location-master-workspace.test.tsx` | **New** UI tests |
| `apps/web/src/app/(app)/assets/[resource]/page.tsx` | Route `/assets/locations` → master workspace |
| `apps/web/src/lib/org-options.ts` | `listBranchOptionsDetailed()` for `company_id` |

### Docs
| File | Change |
|------|--------|
| `docs/ASSET_LOCATION_MASTER_L1_IMPLEMENTATION.md` | This report |

---

## 2. Migration

**Revision:** `0495_org_location_head_office`  
**Down revision:** `0494_ast_assignment_component_timestamps`

Changes:
1. Add `organization.org_location.is_head_office BOOLEAN NOT NULL DEFAULT false`
2. Partial unique index `ux_org_location_company_head_office` on `(company_id)`  
   `WHERE is_head_office = true AND is_deleted = false`
3. Partial unique index `ux_org_location_company_city_building` on  
   `(company_id, lower(btrim(city)), lower(btrim(location_name)))`  
   `WHERE is_deleted = false AND city IS NOT NULL AND btrim(city) <> ''`

Existing rows (including **HQ Campus**) receive `is_head_office = false`.  
No automatic Head Office promotion. Branch `Head Office` / `branch_type` untouched.

---

## 3. API changes

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/locations` | Filters: `branch_id`, `company_id`, `city`, `status`, `is_head_office`. Response includes `city`, `is_head_office`, `version` |
| `POST` | `/locations` | Optional `city`, `is_head_office`, `status`, address fields. Backward compatible |
| `GET` | `/locations/{id}` | **New** |
| `PATCH` | `/locations/{id}` | **New** — supports HO replace via `replace_existing_head_office` |

Permissions reused:
- `organization.location:read`
- `organization.location:create`
- `organization.location:update`

---

## 4. UI changes

`/assets/locations` now renders `AssetLocationMasterWorkspace`:

- Table: City | Building | Code | Head Office | Status | Actions
- Add form: City*, Building*, Code*, Type, Branch*, Status, Head Office checkbox
- Edit panel with status / HO update
- Explicit confirm when transferring Head Office
- Link to Organization module retained

Branch remains a separate required field (schema still needs `branch_id`).

---

## 5. Head Office rule

- At most **one** non-deleted `is_head_office=true` per `company_id`
- Enforced in **service** (create rejects; update requires `replace_existing_head_office=true`)
- Enforced in **DB** (partial unique index) for concurrency
- IntegrityError mapped to `409 Conflict`

---

## 6. Duplicate-location rule

Same company + same city + same building name (case-insensitive, trimmed) → rejected for non-deleted rows.

Allowed:
- Mumbai · CRC-1 and Mumbai · CRC-2
- Mumbai · CRC-1 and Delhi · CRC-1

Legacy rows with `city IS NULL` are outside this unique index (e.g. HQ Campus).

---

## 7. Tenant / company safety

- List/get/create/update scoped by `tenant_id`
- Company/branch access via `OrgScopeValidator`
- Create verifies branch belongs to requested company
- Cross-company branch/location relationships rejected

---

## 8. Tests

### Backend
`test_org_location_service.py` + route registration + existing asset location unit tests:

- Create / city / HO
- One HO per company + concurrent IntegrityError
- Duplicate city+building / same name different cities
- Update / change HO / deactivate
- Cross-company / soft-deleted / list fields

**Result:** 38 passed (org location + org routes + asset location unit/concurrency/validator)

### Frontend
`asset-location-master-workspace.test.tsx` + full Asset suite:

**Result:** 660 passed (44 files)

---

## 9. Regression results

| Area | Status |
|------|--------|
| Asset frontend suite | Pass (660) |
| Asset location unit tests | Pass |
| Org location unit + routes | Pass |
| Add Asset / `asset-site-catalog.ts` | **Unchanged** |
| Branch model | **Unchanged** |
| Assignment / Transfer / Disposal / etc. | **Unchanged** |

---

## 10. Database verification

- Alembic head: `0495_org_location_head_office`
- Migration adds column with `server_default=false` (safe for existing rows)
- Partial unique indexes defined for HO and city+building
- Apply with: `alembic upgrade head` in `apps/api`
- **Live DB apply:** not executed in this session (Postgres on `:5433` was unavailable). Run upgrade when the database is up.

---

## 11. Known limitations (L1)

- No soft-delete API for locations (by design for L1)
- Organization generic list page still read-only generic view; Asset Locations tab is the L1 admin UI
- City is optional on legacy API create (UI requires it)
- Add Asset still uses hardcoded `asset-site-catalog.ts` (L2+)
- No backfill of `ast_asset_location.org_location_id`
- HQ Campus not marked Head Office and not renamed

---

## 12. Explicitly unchanged modules

- `org_branch` / Branch APIs / Dashboard branch KPIs
- Add Asset / `asset-site-catalog.ts`
- Inventory / Assignment / Return / Transfer workflows
- Disposal / Maintenance / Incoming / QC / Excel
- Asset operational status / state machine
- Procurement / Finance
- Asset location transactional APIs (`/assets/asset-locations`) behavior unchanged

---

## Next phase (not started)

**L2:** Wire Add Asset to Location Master (`org_location_id`), retire site catalog, inventory filter alignment, transfer picker, excel validation, optional label backfill.
