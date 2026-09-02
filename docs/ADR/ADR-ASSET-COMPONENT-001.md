# ADR-ASSET-COMPONENT-001 — Asset Component Management (Option B)

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-019  
**Depends on:** FP-ASSET-REG-001, Architecture Lock v1.1

---

## Problem

`ast_asset_component` existed as a thin CRUD scaffold without validator, replace/dispose lifecycle, search/pagination, concurrency control, dedicated RBAC, or a workspace. Productization must stay within Architecture Lock without treating components as assets, inventory, warehouse stock, or procurement items.

## Decisions

| ID | Decision |
|----|----------|
| CMP-01 | **Option B:** lightweight child records on `ast_asset_component` only |
| CMP-02 | Components are **not** assets, inventory, warehouse stock, or procurement items |
| CMP-03 | Hierarchy depth = **1** (Asset → Components); no `parent_component_id`, no recursion |
| CMP-04 | Lifecycle: Install (`active`) → Replace (`replaced` + new `active`) **or** Dispose (`disposed`) |
| CMP-05 | Disposed is terminal; replaced/disposed rows are immutable |
| CMP-06 | Immutability after install: `asset_id`, `component_code` |
| CMP-07 | Drop absolute UK; **partial unique** `(asset_id, component_code) WHERE status='active' AND is_deleted=false` |
| CMP-08 | Soft integration via `asset_id` only (no new FKs to warranty/maintenance/docs) |
| CMP-09 | RBAC: `asset.component:read\|create\|update` (replace/dispose use `:update`) |
| CMP-10 | Layering: Router → AssetComponentService → ComponentValidator → AssetComponentEngine → Repository |
| CMP-11 | Migration `0484` indexes + partial unique + permission seeds |
| CMP-12 | Optimistic locking on update / replace / dispose |
| CMP-13 | Dedicated `AssetComponentsWorkspace` |

## Non-goals

- Nested / recursive component trees
- BOM / MRP / inventory reservation
- Independent asset registration for components
- Workflow / Finance posting for components

## References

- ERD_15 §6.3
- `docs/08_IMPLEMENTATION/Asset_CMP_Feature_Package.md`
