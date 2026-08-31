# ADR-ASSET-MNT-001 — Asset Maintenance (Work Order Governance)

**Status:** Accepted  
**Date:** 2026-07-29  
**Package:** FP-ASSET-004  
**Depends on:** FP-ASSET-WF-GOV-001, FP-ASSET-REG-001, FP-ASSET-002, FP-ASSET-003, Architecture Lock v1.1

---

## Problem

Maintenance work orders existed as a thin scaffold (CRUD + partial WF) without domain validation, asset status coupling, open-WO exclusivity, schedule/start APIs, product workspace, or a seeded `asset.maintenance:update` permission.

## Decisions

| ID | Decision |
|----|----------|
| MNT-01 | Scope = `ast_asset_maintenance` work orders only; plan scheduler out of scope |
| MNT-02 | `start` → asset `in_maintenance`; `complete` → `active` iff no other open WO |
| MNT-03 | One open WO per asset (draft/submitted/approved/scheduled/in_progress) |
| MNT-04 | Pending transfer blocks **start**; disposed/written-off blocks create/start |
| MNT-05 | Reuse `AST_MAINTENANCE_APPROVAL`; reject → cancelled + rejected; cancel/reopen/resubmit |
| MNT-06 | Explicit `schedule` and `start` endpoints |
| MNT-07 | Seed `asset.maintenance:update` + role grants |
| MNT-08 | No Finance GL posting; `cost_amount` informational |
| MNT-09 | Auto-create `ast_asset_service_history` on complete |
| MNT-10 | Expand Pydantic create/update; no new business columns |
| MNT-11 | Dedicated `AssetMaintenanceWorkspace` |
| MNT-12 | Additive migration only (permission, open index, AMNT backfill) |

## Consequences

- Breaking: maintenance create body and list pagination shape.
- Legacy approve when governance flag is off is non-production only.

## References

- `docs/08_IMPLEMENTATION/Asset_MNT_Feature_Package.md`
- `docs/08_IMPLEMENTATION/Asset_MNT_Deployment_Guide.md`
