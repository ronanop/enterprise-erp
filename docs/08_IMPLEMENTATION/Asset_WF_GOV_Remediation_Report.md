# Asset Workflow Governance — Remediation Report

**Feature:** FP-ASSET-WF-GOV-001  
**Date:** 2026-07-29  
**Trigger:** Enterprise Code Review — **REQUIRES CHANGES**  
**Outcome:** Mandatory findings addressed — ready for Enterprise Merge Review

---

## Remediation Items Completed

| # | Finding | Action |
|---|---------|--------|
| 1 | Flag default TRUE unsafe | Default → **`false`** in `core/config.py` |
| 2 | Missing INT-WF-01/02/06 | Added real-`WorkflowService` SQLite integration tests |
| 3 | Missing ADR | `docs/ADR/ADR-ASSET-WF-GOV-001.md` |
| 4 | Missing API Change Log | `docs/08_IMPLEMENTATION/Asset_WF_GOV_API_Change_Log.md` |
| 5 | Missing Testing Report | `docs/08_IMPLEMENTATION/Asset_WF_GOV_Testing_Report.md` |
| 6 | Notification deploy guidance | `docs/08_IMPLEMENTATION/Asset_WF_GOV_Notification_Deployment_Guide.md` |
| 7 | Production checklist | `docs/08_IMPLEMENTATION/Asset_WF_GOV_Production_Checklist.md` |

---

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/core/config.py` | `asset_workflow_governance_enabled` default `False` |
| `docs/08_IMPLEMENTATION/Asset_WF_GOV_Implementation_Report.md` | Align default + test summary |

## Tests Added

| File | Cases |
|------|-------|
| `tests/integration/asset/conftest.py` | WF DB harness + 0266-shaped seed helper |
| `tests/integration/asset/test_asset_workflow_governance.py` | INT-WF-01, INT-WF-02, INT-WF-06 |

**Verification command:**

```bash
pytest src/tests/unit/asset src/tests/security/asset src/tests/integration/asset -q
```

Expected: **10 passed** (7 prior + 3 integration).

## Documentation Added

- ADR-ASSET-WF-GOV-001  
- API Change Log  
- Testing Report  
- Notification Deployment Guide  
- Production Deployment Checklist  
- This Remediation Report  

---

## Risk Reduction

| Risk (from review) | Mitigation |
|--------------------|------------|
| Breaking approve with default-on | Flag defaults **off** — opt-in rollout |
| Undetected multi-step bugs | INT-WF-02 proves activation only on final step |
| Reject mapping unclear | INT-WF-06 + ADR WF-02 |
| Ops enablement without templates | Notification guide + checklist |
| Missing governance decision record | ADR published |

---

## Outstanding Technical Debt (accepted — out of remediation scope)

1. Foundation WF step-role enforcement (platform)  
2. SoD unit tests not duplicated for all five entities  
3. `list_templates` full scan per notify  
4. Silent skip when notification templates missing (documented)  
5. Integration harness is SQLite, not live PostgreSQL  
6. HTTP-level router contract tests not added  

---

## Rollback Verification (flag safety)

With default **`false`**:

- Submit/approve use **legacy** engine path (no WF instance required).  
- Reject raises `InvalidAssetWorkflowState` (“Workflow governance is disabled”) — covered by security test.  
- Enabling flag requires explicit env `ASSET_WORKFLOW_GOVERNANCE_ENABLED=true`.

---

## STOP

Remediation complete. No further features implemented. Awaiting **Enterprise Merge Review**.
