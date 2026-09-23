# ADR-ASSET-SVH-001 — Asset Service History Management

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-013  
**Depends on:** FP-ASSET-005, Architecture Lock v1.1

---

## Problem

Service history existed as a thin scaffold while maintenance complete already auto-created rows. Productization must stay append-only without Workflow or Finance.

## Decisions

| ID | Decision |
|----|----------|
| SVH-01 | Scope = `ast_asset_service_history` only; ERD §6.11 columns only |
| SVH-02 | No Workflow / Finance / Governance |
| SVH-03 | Lifecycle = `recorded` only (terminal) |
| SVH-04 | No `document_number` |
| SVH-05 | RBAC = `asset.maintenance:read`, `:create` (no new resource) |
| SVH-06 | Auto-create on `MaintenanceService.complete()` preserved |
| SVH-07 | Manual POST requires completed maintenance; `asset_id` must match |
| SVH-08 | Immutable — no PATCH endpoint |
| SVH-09 | Multiple rows per maintenance allowed |
| SVH-10 | `serviced_at` defaults to `utcnow()` |
| SVH-11 | `cost_amount` informational only |
| SVH-12 | Dedicated `AssetServiceHistoryWorkspace` |
| SVH-13 | Migration `0478` indexes only |
| SVH-14 | Preserve maintenance auto-history via `record_from_maintenance()` |
| SVH-15 | Register `service-histories` in frontend modules |

## Audit

Manual `POST` creates an `ast_asset_service_history` audit entry via `AuditService`.
`record_from_maintenance()` does **not** emit a second audit record: maintenance
completion is already audited, and the auto-created history row is a derived,
append-only log entry (SVH-14).

## References

- ERD_15 §6.11, §11, §14
- `docs/08_IMPLEMENTATION/Asset_SVH_Feature_Package.md`
