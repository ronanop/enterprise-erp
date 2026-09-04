# ADR-ASSET-TRF-001 — Asset Transfer

**Status:** Accepted  
**Date:** 2026-07-29  
**Package:** FP-ASSET-002  
**Depends on:** FP-ASSET-WF-GOV-001, FP-ASSET-REG-001, Architecture Lock v1.1

---

## Problem

Asset transfers must move custody, department, branch, and location without bypassing workflow governance, finance GL, or cross-company boundaries.

## Decisions

| ID | Decision |
|----|----------|
| TRF-01 | Asset operational status remains **active** (or in_maintenance) after transfer; no status downgrade to “in transit”. |
| TRF-02 | Physical/logical move executes only on **final workflow approval** (`AST_TRANSFER_APPROVAL`). |
| TRF-03 | **No inter-company** transfers; destination branch/department/location must belong to the asset’s company. |
| TRF-04 | **No GL** or `fin_asset_transaction` from Asset transfer execution. |
| TRF-05 | **One pending transfer per asset** (`draft`, `submitted`, or `approved` document) enforced in application layer (indexed for lookup). |

## Consequences

- Manual `POST /asset-transfers/{id}/complete` is removed; clients use submit → approve (per workflow step) → automatic execution.
- Reject maps to `cancelled` + `workflow_status=rejected`; reopen/resubmit follows REG-02 pattern.
- Master `master_asset` sync updates branch, custodian, and `location_id` when `to_org_location_id` is set (master has no department column).

## Rollback

1. Set `ASSET_WORKFLOW_GOVERNANCE_ENABLED=false` only for **non-production** support (violates C-04 when used in prod).
2. Schema rollback: see `docs/08_IMPLEMENTATION/Asset_TRF_Deployment_Guide.md` (0466/0467 limitations).

## References

- `docs/08_IMPLEMENTATION/Asset_TRF_Feature_Package.md`
- `docs/08_IMPLEMENTATION/Asset_TRF_Remediation_Report.md`
