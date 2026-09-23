# ADR-ASSET-MTR-001 — Asset Meter Reading Management

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-015  
**Depends on:** FP-ASSET-REG-001, Architecture Lock v1.1

---

## Problem

Asset meter readings existed as a thin CRUD scaffold without validator, void action, search/pagination, concurrency control, or a dedicated workspace. Productization must stay within Architecture Lock without Workflow, Finance, or Governance.

## Decisions

| ID | Decision |
|----|----------|
| MTR-01 | Scope = `ast_asset_meter_reading` only; ERD §6.18 columns |
| MTR-02 | No Workflow / Finance / Governance |
| MTR-03 | Lifecycle: `recorded` → `void` |
| MTR-04 | Immutable after create — no business PATCH |
| MTR-05 | Non-decreasing `reading_value` per `(asset_id, meter_type)` |
| MTR-06 | Required: `asset_id`, `meter_type`, `reading_value`, `reading_at` |
| MTR-07 | Block disposed / written-off assets |
| MTR-08 | Explicit `asset.company_id == meter reading company_id` validation |
| MTR-09 | RBAC: `read`, `create`, `update`; void uses `:update` |
| MTR-10 | `MeterReadingListResult` paginated list |
| MTR-11 | Migration `0480` indexes only |
| MTR-12 | Optimistic locking on void |
| MTR-13 | Dedicated `AssetMeterReadingWorkspace` |
| MTR-14 | No maintenance-plan / audit integration in v1 |
| MTR-15 | Create concurrency via `lock_create_scope` (FOR UPDATE on latest reading or parent asset) |

## Concurrency note

`MeterReadingService.create()` calls `lock_create_scope()` before validation to serialize concurrent creates for the same `(asset_id, meter_type)` within a transaction.

## References

- ERD_15 §6.18
- `docs/08_IMPLEMENTATION/Asset_MTR_Feature_Package.md`
