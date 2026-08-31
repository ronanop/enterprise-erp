# ADR-ASSET-LOC-001 — Asset Location Management

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-012  
**Depends on:** FP-ASSET-REG-001, FP-ASSET-005 (Transfer), Architecture Lock v1.1

---

## Problem

Asset locations existed as a thin scaffold (CRUD only) without validator, complete action, search/pagination, correct RBAC, or a workspace. Productization must stay within Architecture Lock without Finance or Workflow, and must preserve `TransferService` location side-effects.

## Decisions

| ID | Decision |
|----|----------|
| LOC-01 | Scope = `ast_asset_location` only; ERD §6.6 columns only |
| LOC-02 | No approval workflow / no `AssetGovernanceService` / no Finance |
| LOC-03 | Lifecycle: `active → historical` per ERD §11 |
| LOC-04 | No `document_number` |
| LOC-05 | On create: supersede existing `is_current=true` rows for same asset |
| LOC-06 | `POST /{id}/complete` marks historical; no status PATCH for lifecycle |
| LOC-07 | Updates allowed on `active` only; block `historical` |
| LOC-08 | Block disposed / written-off / cancelled assets |
| LOC-09 | Permissions = ERD `read`, `create`, `complete` only; PATCH metadata uses `:create` |
| LOC-10 | Dedicated `AssetLocationWorkspace` |
| LOC-11 | Additive migration `0477` (partial index, permission grants) |
| LOC-12 | Optimistic version claim on complete |
| LOC-13 | Preserve `TransferService` location side-effects unchanged |
| LOC-14 | `org_location_id` UUID-only validation (no org module FK write) |

## References

- ERD_15 §6.6, §11, §12, §14
- `docs/08_IMPLEMENTATION/Asset_LOC_Feature_Package.md`
