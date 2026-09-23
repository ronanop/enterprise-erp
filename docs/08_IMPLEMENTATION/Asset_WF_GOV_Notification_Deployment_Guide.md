# Asset Workflow Governance — Notification Deployment Guide

**Feature:** FP-ASSET-WF-GOV-001 (WF-04)  
**Date:** 2026-07-29

---

## Required Templates

Governance calls Foundation `NotificationService.send` when an **active** template exists for the tenant. Codes (from `modules/asset/domain/workflow_codes.py`):

| Event | Template code | When |
|-------|---------------|------|
| Submit | `AST_WF_SUBMITTED` | After WF instance create |
| Intermediate approve | `AST_WF_STEP_APPROVED` | WF still `in_progress` |
| Final approve | `AST_WF_APPROVED` | WF terminal `approved` |
| Reject | `AST_WF_REJECTED` | After reject |

Recommended channel for v1: **`in_app`**.

---

## Required Seeds

1. **Workflow definitions:** Alembic `0266_seed_asset_workflows` (or equivalent) applied for each tenant.
2. **Notification templates:** Create via Foundation notifications API / admin UI, e.g.:

```text
POST /api/v1/notifications/templates
{
  "template_code": "AST_WF_APPROVED",
  "template_name": "Asset workflow approved",
  "channel": "in_app",
  "subject_template": "Asset document approved",
  "body_template": "Entity {{entity_name}} {{entity_id}} was approved."
}
```

Repeat for all four codes. Payload keys available: `entity_name`, `entity_id`.

---

## Deployment Validation

1. Confirm templates listed for tenant (`GET` notification templates) with `is_active=true`.
2. Enable `ASSET_WORKFLOW_GOVERNANCE_ENABLED=true` in a non-prod env.
3. Submit an asset as user A; approve as user B through all steps.
4. Confirm notification events/deliveries created for submit and approve (if Celery worker running).
5. Reject path: confirm `AST_WF_REJECTED` event when template present.

---

## Failure Behaviour

| Condition | Behaviour |
|-----------|-----------|
| Template missing | **Silent skip** — WF/audit still succeed |
| Template inactive | Skip (same as missing) |
| Celery/broker down | `send` may raise and fail the request transaction — treat as ops incident; ensure worker health before enablement |
| Recipient null | Event still created with `recipient_user_id=null` (creator preferred when available) |

---

## Rollback

1. Disable governance flag **or** deactivate templates — either stops user-visible notifies.
2. Flag off restores legacy approve path (no governance notifies).
3. Do not delete WF definitions solely for notification rollback.
