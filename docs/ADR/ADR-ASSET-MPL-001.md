# ADR-ASSET-MPL-001 — Asset Maintenance Plan Management

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-011  
**Depends on:** FP-ASSET-REG-001, FP-ASSET-005, Architecture Lock v1.1

---

## Problem

Maintenance plans existed as a thin scaffold (CRUD only) without validator, lifecycle actions, search/pagination, dedicated permissions, or a workspace. Productization must stay within Architecture Lock without Finance or Workflow.

## Decisions

| ID | Decision |
|----|----------|
| MPL-01 | Scope = `ast_asset_maintenance_plan` only; ERD §6.9 columns only |
| MPL-02 | No approval workflow / no `AssetGovernanceService` / no Finance |
| MPL-03 | Lifecycle: draft → active ↔ paused → closed per ERD §11 |
| MPL-04 | `AMPL-YYYY-NNNNNN` via `DocumentNumberService` |
| MPL-05 | `next_due_date` required before activate |
| MPL-06 | Close from `active` or `paused` only; not from `draft` |
| MPL-07 | WO `maintenance_plan_id` must reference `active` plan for same asset |
| MPL-08 | Updates allowed on `draft`, `active`, `paused`; block `closed` |
| MPL-09 | Dedicated `asset.maintenance_plan:*` permissions (not `asset.maintenance`) |
| MPL-10 | Dedicated `AssetMaintenancePlanWorkspace` |
| MPL-11 | Additive migration `0476` (permissions, partial index, AMPL backfill) |
| MPL-12 | Optimistic version claim on activate / pause / resume / close |
| MPL-13 | No one-plan-per-asset exclusivity (ERD silent) |
| MPL-14 | `frequency_meter_units` stored only; no meter module dependency |
| MPL-15 | Auto work-order generation out of scope; Celery stub unchanged |

## References

- ERD_15 §6.9
- `docs/08_IMPLEMENTATION/Asset_MPL_Feature_Package.md`
