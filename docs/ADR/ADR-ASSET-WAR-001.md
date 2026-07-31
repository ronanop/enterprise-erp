# ADR-ASSET-WAR-001 — Asset Warranty Management

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-009  
**Depends on:** FP-ASSET-REG-001, Architecture Lock v1.1

---

## Problem

Asset warranty existed as a thin scaffold (CRUD only) without validator, lifecycle actions, search/pagination, action permissions, or a dedicated workspace. Productization must stay within Architecture Lock without Finance or Workflow.

## Decisions

| ID | Decision |
|----|----------|
| WAR-01 | Scope = warranty policy rows on `ast_asset_warranty`; no insurance |
| WAR-02 | No approval workflow / no `AssetGovernanceService` / no Finance |
| WAR-03 | Lifecycle: draft → active → extended → expired (void retained for ERD compatibility, not productized) |
| WAR-04 | Require `asset_id`, `start_date`, `end_date`, `warranty_type` on create |
| WAR-05 | `vendor_id` required for `extended` and `service` types |
| WAR-06 | Updates only while `draft` or `active`; block expired |
| WAR-07 | Activate draft only; one open (`active`/`extended`) warranty per asset |
| WAR-08 | Extend from `active` only; `new_end_date` > current `end_date` |
| WAR-09 | Expire from `active` or `extended` |
| WAR-10 | Block disposed / written_off assets |
| WAR-11 | Seed `activate` / `extend` / `expire` permissions; PATCH uses `:update` |
| WAR-12 | Dedicated `AssetWarrantyWorkspace` |
| WAR-13 | Additive migration `0474` (status constraint expand, open index, permission seed) |
| WAR-14 | Optimistic version claim on activate / extend / expire |
| WAR-15 | No `document_number` column (ERD §6.7); document sequence N/A |
| WAR-16 | API field `expiry_date` filter maps to `end_date` |

## Status constraint note

ERD historically listed `active|expired|void`. Productization adds `draft` and `extended` via additive CheckConstraint expansion only — no new business columns.

## References

- ERD_15 §6.7
- `docs/08_IMPLEMENTATION/Asset_WAR_Feature_Package.md`
