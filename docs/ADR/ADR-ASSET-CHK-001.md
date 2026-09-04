# ADR-ASSET-CHK-001 — Asset Checklist Management

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-014  
**Depends on:** FP-ASSET-REG-001, FP-ASSET-005, FP-ASSET-008, Architecture Lock v1.1

---

## Problem

Asset checklists existed as a thin CRUD scaffold without validator, lifecycle actions, search/pagination, or a dedicated workspace. Productization must stay within Architecture Lock without Workflow, Finance, or Governance.

## Decisions

| ID | Decision |
|----|----------|
| CHK-01 | Scope = checklist rows on `ast_asset_checklist`; no workflow engine |
| CHK-02 | No approval workflow / no `AssetGovernanceService` / no Finance |
| CHK-03 | Lifecycle: `draft` → `completed` \| `cancelled` |
| CHK-04 | At least one of `asset_id`, `maintenance_id`, `audit_id` required on create |
| CHK-05 | `checklist_code` and `checklist_name` required; code unique per company |
| CHK-06 | Updates only while `draft`; terminal states immutable |
| CHK-07 | Complete requires `items_json` with required item results (`pass`/`fail`/`na`) |
| CHK-08 | Cancel from `draft` only; sets no `completed_at` |
| CHK-09 | Block disposed / written-off assets |
| CHK-10 | Reuse existing RBAC: `read`, `create`, `update`; complete/cancel use `:update` |
| CHK-11 | Dedicated `AssetChecklistWorkspace` |
| CHK-12 | Additive migration `0479` (search indexes + partial unique on company/code) |
| CHK-13 | Optimistic version claim on update / complete / cancel |
| CHK-14 | GET list returns `AssetChecklistListResult` (paginated) |
| CHK-15 | `items_json` shape: `{ "items": [{ "label", "required?", "result?" }] }` |

## Status constraint note

ERD §6.17 lists `draft|completed|cancelled`. No new business columns; governance migration adds indexes only.

## References

- ERD_15 §6.17
- `docs/08_IMPLEMENTATION/Asset_CHK_Feature_Package.md`
