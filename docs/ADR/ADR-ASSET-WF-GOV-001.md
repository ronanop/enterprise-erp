# ADR-ASSET-WF-GOV-001 — Asset Workflow Governance (C-AST-01)

**Status:** Accepted (remediation complete)  
**Date:** 2026-07-29  
**Package:** FP-ASSET-WF-GOV-001  
**Relates to:** Architecture Lock v1.1 C-04 / DG-03 · ERD-15 §12 · FRD-12 §15

---

## Problem

Asset Management approvals (asset, assignment, maintenance, disposal, revaluation) advanced document `status` via in-process domain engines and RBAC alone. Columns `workflow_instance_id` / `workflow_status` existed and workflow definitions were seeded (`0266`), but Foundation `WorkflowService` was never invoked — violating Architecture Lock **C-04** (all business approvals through the Workflow Engine).

## Decision

1. Introduce **`AssetGovernanceService`** patterned after Procurement governance: submit creates a `wf_instance`; approve advances the instance; domain terminal transitions run only when the instance reaches **`approved`** (WF-01).
2. Map entities via **`WORKFLOW_CODES`** to seeded codes `AST_*` (ERD-15 / 0266).
3. Reject sets document **`status=cancelled`** and **`workflow_status=rejected`** (WF-02) without adding a `rejected` CHECK value.
4. Call Foundation **`NotificationService.send`** when templates exist (WF-04); skip silently if templates are absent.
5. Gate runtime with **`ASSET_WORKFLOW_GOVERNANCE_ENABLED`**, default **`false`**, so environments opt in after seeds, templates, and client readiness.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep status-only approve | Violates Lock C-04 |
| Always-on governance (flag default true) | Breaks single-call clients; unsafe without cutover |
| Add `rejected` status via migration | Unnecessary; `cancelled` satisfies ERD CHECK |
| Copy Procurement audit-only `_notify` | Violates Lock C-05 intent (must use NotificationService) |

## Consequences

- **Positive:** Auditable multi-step approvals; Lock C-04 compliance when flag is on; rollback via flag.
- **Negative:** Approve is multi-step (breaking semantic); clients must call approve once per remaining step or use an inbox.
- **Operational:** Tenants need 0266 workflow seeds and optional `AST_WF_*` notification templates before enablement.

## Trade-offs

| Trade-off | Choice |
|-----------|--------|
| Safety vs compliance-by-default | Flag **default false** (opt-in) |
| Reject status vocabulary | Map to `cancelled` (no schema change) |
| Step-role enforcement | Deferred to Foundation platform (known gap) |

## Rollback

1. Set `ASSET_WORKFLOW_GOVERNANCE_ENABLED=false` and redeploy.
2. Legacy single-step approve path resumes (non–C-04; support-only).
3. In-flight `wf_instance` rows may be cancelled via Foundation workflow APIs if needed.

## References

- Feature Package FP-ASSET-WF-GOV-001  
- Enterprise Code Review (REQUIRES CHANGES → remediation)  
- `docs/08_IMPLEMENTATION/Asset_WF_GOV_Implementation_Report.md`
