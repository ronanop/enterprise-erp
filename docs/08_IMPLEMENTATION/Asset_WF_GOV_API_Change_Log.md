# Asset Workflow Governance — API Change Log

**Feature:** FP-ASSET-WF-GOV-001 / C-AST-01  
**Date:** 2026-07-29  
**API prefix:** `/api/v1/assets`

---

## New Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/assets/{id}/reject` | `asset.asset:approve` | Reject in-flight asset WF |
| POST | `/asset-assignments/{id}/reject` | `asset.assignment:approve` | Reject assignment WF |
| POST | `/asset-maintenances/{id}/reject` | `asset.maintenance:approve` | Reject maintenance WF |
| POST | `/asset-disposals/{id}/reject` | `asset.disposal:approve` | Reject disposal WF |
| POST | `/asset-revaluations/{id}/reject` | `asset.revaluation:approve` | Reject revaluation WF |

Optional body (all reject/approve when governance enabled):

```json
{ "comments": "optional free text" }
```

Schema: `WorkflowActionRequest`.

---

## Changed Behaviour

Applies when **`ASSET_WORKFLOW_GOVERNANCE_ENABLED=true`**.

| Endpoint | Previous | New |
|----------|----------|-----|
| `POST .../submit` | Domain status → `submitted` only | Also creates `wf_instance`; sets `workflow_instance_id`, `workflow_status=in_progress` |
| `POST .../approve` | Immediate domain approve (+ asset activate/master) | Advances workflow step; **domain terminal actions only on final WF approval** |
| Asset final approve | Same as above | Activates asset and links `master_asset` on **last** step only |

When **`ASSET_WORKFLOW_GOVERNANCE_ENABLED=false`** (default): submit/approve behave as pre-governance (legacy); reject returns workflow-disabled error.

---

## Backward Compatibility

| Aspect | Compatible? |
|--------|-------------|
| URL paths for submit/approve | Yes |
| Response shape (document DTO) | Yes (fields already present) |
| Empty-body approve POST | Yes (`WorkflowActionRequest` optional) |
| Single approve → fully approved/active | **No** when flag on (multi-step) |

---

## Breaking Changes

1. **Semantic:** With governance enabled, one `approve` call may leave the document `submitted` until all WF steps complete.
2. **SoD:** Document creator cannot approve (403 / conflict).
3. **Reject:** New; unavailable when flag is off.

---

## Migration Notes for API Consumers

1. Keep flag **false** until clients support multi-step approve or Foundation inbox.
2. After enablement: poll `workflow_status` / `status`, or approve until `workflow_status=approved`.
3. Handle SoD: use a different user than `created_by` for approve.
4. Ensure tenant has workflow definitions from Alembic `0266_seed_asset_workflows`.
5. Optional: seed notification templates (see Notification Deployment Guide).
