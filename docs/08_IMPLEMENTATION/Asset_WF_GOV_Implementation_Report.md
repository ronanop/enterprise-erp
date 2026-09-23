# Asset Workflow Governance — Implementation Report (FP-ASSET-WF-GOV-001)

**Date:** 2026-07-29  
**Status:** Complete — pending review  
**Compliance:** Architecture Lock C-04 (workflow-backed approvals)

## Summary

Implemented Asset Workflow Governance per approved Feature Package: Foundation `WorkflowService` drives submit/approve/reject for five document types, with `AssetGovernanceService`, audit logging, optional Foundation notifications, SoD checks, and feature flag rollback.

## Files Changed

### New

| File | Purpose |
|------|---------|
| `modules/asset/domain/workflow_codes.py` | Entity → `AST_*` workflow code map + notification template codes |
| `modules/asset/service/governance_service.py` | Workflow + audit + `NotificationService.send` |
| `modules/asset/service/workflow_governance_settings.py` | Feature flag accessor |
| `tests/unit/asset/test_workflow_codes.py` | Code map tests |
| `tests/unit/asset/test_workflow_governance.py` | Terminal vs intermediate approve |
| `tests/security/asset/test_asset_workflow_security.py` | SoD + instance required |

### Modified

| File | Change |
|------|--------|
| `core/config.py` | `ASSET_WORKFLOW_GOVERNANCE_ENABLED` (default **`false`**) |
| `modules/asset/domain/exceptions.py` | `InvalidAssetWorkflowState`, `SegregationOfDutiesError` |
| `modules/asset/service/asset_service.py` | WF submit/approve/reject + legacy path |
| `modules/asset/service/assignment_service.py` | Same |
| `modules/asset/service/maintenance_service.py` | Same |
| `modules/asset/service/disposal_service.py` | Same |
| `modules/asset/service/revaluation_service.py` | Same |
| `modules/asset/schemas.py` | `WorkflowActionRequest` |
| `modules/asset/routers/__init__.py` | Optional comments body; five `reject` routes |

## API Changes

| Method | Path | Change |
|--------|------|--------|
| POST | `/api/v1/assets/assets/{id}/approve` | Optional body `{ "comments": "..." }`; multi-step WF semantics |
| POST | `/api/v1/assets/assets/{id}/reject` | **New** |
| POST | `.../asset-assignments/{id}/approve` | Optional comments; multi-step |
| POST | `.../asset-assignments/{id}/reject` | **New** |
| POST | `.../asset-maintenances/{id}/approve` | Optional comments; multi-step |
| POST | `.../asset-maintenances/{id}/reject` | **New** |
| POST | `.../asset-disposals/{id}/approve` | Optional comments; multi-step |
| POST | `.../asset-disposals/{id}/reject` | **New** |
| POST | `.../asset-revaluations/{id}/approve` | Optional comments; multi-step |
| POST | `.../asset-revaluations/{id}/reject` | **New** |

Submit endpoints unchanged in path; behaviour creates `wf_instance` when governance enabled.

## Workflow Changes

- Submit: `WorkflowService.create_instance`, persist `workflow_instance_id`, `workflow_status=in_progress`, document `status=submitted`.
- Approve: advances WF; domain transition (`approved` / `active` / master link) only when instance reaches `approved`.
- Reject: `workflow_status=rejected`, document `status=cancelled` (WF-02).
- Seeds: existing `0266_seed_asset_workflows` (no migration).

## Testing Summary

```
pytest src/tests/unit/asset src/tests/security/asset src/tests/integration/asset — all passed
```

See also: `Asset_WF_GOV_Testing_Report.md` (includes INT-WF-01/02/06).

## Known Limitations

1. **Notification templates** (`AST_WF_SUBMITTED`, etc.) must exist per tenant or sends are skipped (by design).
2. **WF step role enforcement** not implemented in Foundation `WorkflowService` (platform-wide).
3. **WF-03** disposal seed roles unchanged (separate EARB track).
4. **Reject** requires governance enabled; returns error when flag off.
5. **Finance `post`** unchanged; still requires domain `approved` after terminal WF.

## Rollback

Set `ASSET_WORKFLOW_GOVERNANCE_ENABLED=false` and redeploy to restore legacy single-step approve behaviour (non-compliant with C-04).
