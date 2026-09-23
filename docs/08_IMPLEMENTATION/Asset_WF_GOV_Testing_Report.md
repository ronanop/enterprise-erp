# Asset Workflow Governance — Testing Report

**Feature:** FP-ASSET-WF-GOV-001  
**Date:** 2026-07-29  
**Scope:** C-AST-01 remediation + original implementation tests

---

## Unit Tests

| File | Coverage |
|------|----------|
| `tests/unit/asset/test_workflow_codes.py` | WORKFLOW_CODES map to 0266 codes |
| `tests/unit/asset/test_workflow_governance.py` | `on_approved` only on terminal APPROVED; skipped on IN_PROGRESS |

**Result:** Passed

---

## Security Tests

| File | Coverage |
|------|----------|
| `tests/security/asset/test_asset_workflow_security.py` | SoD on asset & assignment approve; missing instance; reject blocked when flag off |

**Result:** Passed  
**Gap (accepted debt):** SoD not unit-tested for maintenance / disposal / revaluation (same code path pattern).

---

## Integration Tests

| ID | Test | Behaviour verified |
|----|------|-------------------|
| INT-WF-01 | `test_int_wf_01_submit_creates_workflow_instance` | Real `WorkflowService` + 0266-shaped seed; submit sets instance + fields |
| INT-WF-02 | `test_int_wf_02_three_step_approve_activates_only_on_final` | Steps 1–2 stay `submitted`; step 3 → `active` + master id |
| INT-WF-06 | `test_int_wf_06_reject_sets_cancelled_and_workflow_rejected` | Reject → `cancelled` / `workflow_status=rejected` |

**Harness:** SQLite in-memory with real `WfDefinition` / `WfStep` / `WfInstance` / `WfAction` / `AstAsset` tables; **WorkflowService not mocked**. Audit/notification persistence silenced to isolate WF path. Master adapter mocked only on INT-WF-02 terminal activate.

**Result:** Passed

---

## Regression Tests

| Suite | Result |
|-------|--------|
| `tests/unit/asset` + `tests/security/asset` + `tests/integration/asset` | All green after remediation |

Legacy path (flag default **false**) preserves pre-governance approve behaviour for unmigrated clients.

---

## Coverage Summary

| Layer | Status |
|-------|--------|
| Workflow codes | Covered |
| Governance terminal callback | Covered |
| SoD (asset, assignment) | Covered |
| Multi-step approve | Covered (integration) |
| Reject | Covered (integration + flag-off security) |
| HTTP routers | Not HTTP-tested (service-level) |
| Notification template send | Not covered (skipped when no templates) |

---

## Known Limitations

1. Integration harness is SQLite + schema translate (not live PostgreSQL). Workflow **logic** and **seed shape** match production; DDL/FK differences exist.
2. Audit/notification DB writes not asserted in INT tests.
3. No automated OpenAPI contract test.
4. Step-role enforcement not tested (platform gap, out of scope).
