# ADR-ASSET-ASN-001 — Asset Assignment (Allocation)

**Status:** Accepted  
**Date:** 2026-07-29  
**Package:** FP-ASSET-003  
**Depends on:** FP-ASSET-WF-GOV-001, FP-ASSET-REG-001, FP-ASSET-002, Architecture Lock v1.1

---

## Problem

Asset allocation (assignment) existed as a thin scaffold without custody side effects, exclusive/shared rules, or a product workspace, while Transfer was already productized.

## Decisions

| ID | Decision |
|----|----------|
| ASN-01 | Assignment = allocate/return; Transfer = move; pending transfer blocks assignment |
| ASN-02 | Final approve activates and updates `ast_asset` custody by allocation type |
| ASN-03 | `is_shared=false` → one pending/active assignment; `true` → multiples allowed |
| ASN-04 | Exclusive rule enforced in application layer (+ partial index) |
| ASN-05 | `warehouse` type is branch-scoped (document `branch_id`); no `warehouse_id` |
| ASN-06 | Return clears matching employee custodian only; does not revert branch/department |
| ASN-07 | Master sync branch/custodian only via existing adapter |
| ASN-08 | Reuse `AST_ASSIGNMENT_APPROVAL`; reject → cancelled + rejected; cancel/reopen/resubmit |
| ASN-09 | Expand create schemas; paginated list; keep `/return`; add `:update` |
| ASN-10 | No new business columns |
| ASN-11 | Additive migration: update permission, index, AASN backfill |
| ASN-12–15 | RBAC+SoD, audit activate/return, `AST_WF_*` notifications, pending/active index |

## Consequences

- Breaking: assignment create body and list pagination shape.
- Legacy approve when governance flag is off is non-production only.

## References

- `docs/08_IMPLEMENTATION/Asset_ASN_Feature_Package.md`
- `docs/08_IMPLEMENTATION/Asset_ASN_Deployment_Guide.md`
