# ADR-ASSET-AUD-001 — Asset Audit (Physical Verification)

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-008  
**Depends on:** FP-ASSET-REG-001, Architecture Lock v1.1

---

## Problem

Physical asset audit existed as a thin scaffold without validator, start/cancel APIs, search/pagination, `:update` permission seed, or a dedicated workspace. ERD defines no approval workflow for audits.

## Decisions

| ID | Decision |
|----|----------|
| AUD-01 | Scope = physical verification rows; no reporting/dashboards |
| AUD-02 | No approval workflow / no `AssetGovernanceService` |
| AUD-03 | Lifecycle: planned → in_progress → completed \| cancelled |
| AUD-04 | Require `asset_id` and `auditor_employee_id` on create |
| AUD-05 | `audit_date` required before start; `found_status` required before complete |
| AUD-06 | Updates only while `planned` |
| AUD-07 | Block disposed / written_off assets |
| AUD-08 | Seed `asset.audit:update`; PATCH / start use it |
| AUD-09 | Dedicated `AssetAuditWorkspace` |
| AUD-10 | Additive migration `0473` (permission, open index, AAUD backfill) |
| AUD-11 | Optimistic version claim on complete |
| AUD-12 | No Finance integration |
| AUD-13 | Checklist/meter expansion out of scope |

## References

- ERD_15 §6.15
- `docs/08_IMPLEMENTATION/Asset_AUD_Feature_Package.md`
