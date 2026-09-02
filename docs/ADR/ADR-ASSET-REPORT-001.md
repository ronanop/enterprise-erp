# ADR-ASSET-REPORT-001 — Asset Reports (Hybrid Live + Snapshot)

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-018  
**Depends on:** FP-ASSET-001→017, Architecture Lock v1.1

---

## Problem

Asset reporting existed as thin CRUD on `ast_asset_report` without live aggregation, dashboard, export, or a workspace. Productization must remain **read-only** on operational tables and must not duplicate the Analytics BI platform.

## Decisions

| ID | Decision |
|----|----------|
| RPT-01 | Hybrid model: live query reports primary; `ast_asset_report` snapshots secondary |
| RPT-02 | WRITE only `ast_asset_report`; never mutate other `ast_*` tables |
| RPT-03 | Live `report_key` catalog independent of DB CHECK |
| RPT-04 | Snapshot `report_type` CHECK expanded (ADR) for FRD alignment |
| RPT-05 | Lifecycle: draft → finalized (immutable) |
| RPT-06 | RBAC: `asset.report:read` / `asset.report:export` |
| RPT-07 | No Analytics / Portal / Celery schedules in Phase 1 |
| RPT-08 | Export CSV/XLSX via FE helpers + audited export API payload |
| RPT-09 | Migration `0483` indexes + CHECK expand only |
| RPT-10 | Dedicated `AssetReportsWorkspace` |

## CHECK expansion

Added: `warranty_expiry`, `allocation`, `transfer`, `disposal`, `documents`, `checklists`, `meters`, `notifications`  
Retained: `register`, `depreciation_schedule`, `utilization`, `maintenance_due`, `insurance_expiry`, `audit_variance`

## References

- ERD_15 §6.20
- FRD-12 §21
- `docs/08_IMPLEMENTATION/Asset_RPT_Feature_Package.md`
