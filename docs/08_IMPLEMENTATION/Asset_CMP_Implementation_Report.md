# Asset CMP — Implementation Report (FP-ASSET-019)

**Date:** 2026-07-30  
**Status:** Implementation complete — ready for architecture review  
**ADR:** ADR-ASSET-COMPONENT-001

---

## 1. Executive Summary

FP-ASSET-019 productizes Asset Components as **Option B** lightweight child records under a parent asset. Depth is fixed at **1** (Asset → Components). Lifecycle covers Install → Active → Replace or Dispose, with history preserved via a partial unique index on active codes. Dedicated RBAC, search/pagination, tree/history APIs, optimistic locking, audit, workspace UI, tests (42), and documentation are delivered without redesigning Architecture Lock v1.1 patterns.

## 2. Architecture Compliance

| Gate | Result |
|------|--------|
| Architecture Lock v1.1 unchanged | ✓ |
| Router → Service → Validator → Engine → Repository | ✓ |
| Option B (not assets / inventory / warehouse / procurement) | ✓ |
| Depth 1; no `parent_component_id`; no recursive SQL | ✓ |
| Reuse of existing AST patterns (DOC/NTF peers) | ✓ |

## 3. Backend Changes

- `ComponentValidator` — parent/company/branch/code/serial/quantity/status/immutability/replace/dispose
- `AssetComponentEngine` — install defaults, replace, dispose
- `AssetComponentRepository` — search, tree-by-asset, active code/serial lookups, code history, optimistic update
- `AssetComponentService` (+ `ComponentService` alias) — orchestration, audit, scope
- Schemas: Create / Update / Replace / List / Tree / History / ReplaceResult
- Router `/asset-components` with dedicated `asset.component:*` permissions

## 4. Frontend Changes

- `AssetComponentsWorkspace` — asset selector, list, hierarchy panel, history timeline, install / replace / dispose
- `componentService` in `assets-service.ts`
- Wired in `assets/[resource]/page.tsx` and modules description update
- Follows MASTER / existing asset workspace density (Swiss/data-dense dashboard)

## 5. Database Changes

Migration `0484_ast_component_governance`:

- Drop `uk_ast_asset_component_code`
- Partial unique `uq_ast_asset_component_active_code`
- Supporting indexes
- Permission seeds for `asset.component:read|create|update`

Table `ast_asset_component` not redesigned or recreated.

## 6. API Summary

| Method | Path |
|--------|------|
| GET | `/asset-components` |
| GET | `/asset-components/tree` |
| GET | `/asset-components/{id}` |
| GET | `/asset-components/{id}/history` |
| POST | `/asset-components` |
| PATCH | `/asset-components/{id}` |
| POST | `/asset-components/{id}/replace` |
| POST | `/asset-components/{id}/dispose` |

## 7. Hierarchy Summary

```
Asset
 └── Components (depth = 1)
```

No nested components. Tree query is a flat list by `asset_id`.

## 8. Lifecycle Summary

```
Install → Active → Replace (old=replaced + new=active)
                 → Dispose (terminal)
```

Immutability: `asset_id`, `component_code` after install; no updates after replaced/disposed.

## 9. Security Summary

- Permissions: `asset.component:read`, `:create`, `:update`
- Tenant / company isolation via scoped repository + validator
- Branch validation via `AssetScopeValidator`
- Audit on install / update / replace / dispose

## 10. Performance Summary

- Indexed company/status, asset/status, code, serial
- Paginated search; tree by asset (non-recursive)
- Optimistic locking on mutating lifecycle actions

## 11. Testing Results

```
42 passed
```

Coverage areas: validator, engine, service, repository concurrency/search, routes (RBAC, tenant, company, OpenAPI), workflow (install/replace/dispose/history/tree/pagination).

## 12. Documentation Delivered

| Document | Path |
|----------|------|
| ADR | `docs/ADR/ADR-ASSET-COMPONENT-001.md` |
| Feature Package | `docs/08_IMPLEMENTATION/Asset_CMP_Feature_Package.md` |
| Deployment Guide | `docs/08_IMPLEMENTATION/Asset_CMP_Deployment_Guide.md` |
| Migration Notes | `docs/08_IMPLEMENTATION/Asset_CMP_Migration_Notes.md` |
| Release Notes | `docs/08_IMPLEMENTATION/Asset_CMP_Release_Notes.md` |
| Implementation Report | `docs/08_IMPLEMENTATION/Asset_CMP_Implementation_Report.md` |

## 13. Risks / Deviations

- **None material.** Absolute UK → partial unique is an intentional approved change to enable replace history with the same `component_code`.
- Pre-upgrade: environments with duplicate *active* `(asset_id, component_code)` must be cleaned before `0484`.
- Soft linkage only via `asset_id` (no cross-FP FK expansion) per planning Option B.

---

=========================================================

IMPLEMENTATION COMPLETED

READY FOR ARCHITECTURE REVIEW

=========================================================
