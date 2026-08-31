# CR-001 — Asset Category Management Enhancement

**Status:** Implemented  
**Module:** Asset Management  
**Date:** 2026-07-30  
**Baseline:** Post FP-ASSET-019

---

## Business Requirement

Improve Asset Category management so administrators can:

- View categories
- Create categories
- Edit categories
- Deactivate categories (business delete)
- Reactivate categories

**Hard rule:** Never physically delete categories.

---

## Previous State

- Backend: list/get/create/update on `AssetCategoryService`; `AssetCategoryEngine.deactivate` existed but was unused.
- Schemas: `AssetCategoryCreate` / `Update` incomplete (status/company only).
- Frontend: generic `ResourceListView` for `/assets/asset-categories`.
- Registration dropdown loaded all categories (including inactive).

---

## Gap Analysis

| Gap | Resolution |
|-----|------------|
| Incomplete DTOs | Completed Create/Update/Response fields |
| No deactivate/reactivate API | Added POST endpoints |
| No referential guard | Validator blocks deactivate when operational assets reference category |
| Weak UI | Dedicated `AssetCategoryWorkspace` |
| Inactive in registration | Filter `status=active` + client filter |

---

## Technical Design

```text
Router (asset-categories)
  → AssetCategoryService
      → CategoryValidator
      → AssetCategoryEngine (activate / deactivate)
      → AssetCategoryRepository
      → AssetRepository.count_operational_by_category (guard)
      → AuditService
```

Business delete = `status = inactive`. No soft-delete and no SQL DELETE.

---

## Backend Changes

- `schemas.py` — complete category DTOs
- `category_validator.py` — create/update/deactivate rules
- `asset_category_service.py` — create/update/deactivate/reactivate + audit
- `asset_category_engine.py` — reactivate only from inactive
- `asset_category_repository.py` — get_by_code, search filters, optimistic version
- `asset_repository.py` — `count_operational_by_category`
- `routers/__init__.py` — list `status`/`q`; POST deactivate/reactivate
- `domain/exceptions.py` — `CategoryValidationError`

Permissions reused: `asset.category:read|create|update`.

---

## Frontend Changes

- `asset-category-workspace.tsx` — search, pagination, table, create, edit, confirm deactivate/reactivate
- `[resource]/page.tsx` — route `asset-categories` → dedicated workspace
- `assets-service.ts` — `assetCategoryService` + `filterActiveCategories`
- `asset-registration-workspace.tsx` — active-only category dropdown

---

## API Changes

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/assets/asset-categories?status=&q=` | read |
| POST | `/api/v1/assets/asset-categories` | create |
| PATCH | `/api/v1/assets/asset-categories/{id}` | update |
| POST | `/api/v1/assets/asset-categories/{id}/deactivate` | update |
| POST | `/api/v1/assets/asset-categories/{id}/reactivate` | update |

Existing routes preserved (additive query params only on list).

---

## Database Impact

**None.** Reuses `ast_asset_category.status`, audit, version. No migrations.

---

## Testing

- `test_category_engine.py`
- `test_category_validator.py`
- `test_category_service.py`
- FE: `asset-category-filter.test.mjs` (`node --test`)
- Regression: registration validator already requires active categories

---

## Rollback

1. Remove deactivate/reactivate routes and revert service methods.
2. Point FE page back to `ResourceListView`.
3. No DB rollback required.

---

## Final Result

CR-001 delivered with Clean Architecture intact, no hard delete, no migrations, registration dropdown filtered to active categories.
