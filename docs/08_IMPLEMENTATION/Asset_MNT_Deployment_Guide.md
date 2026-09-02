# Asset Maintenance — Deployment Guide (FP-ASSET-004)

## 1. Migrations

```bash
cd apps/api
alembic upgrade head
```

Head includes `0469_ast_maintenance_governance`:

- Seeds `asset.maintenance:update` and grants to Asset roles
- Partial index on open work orders by `asset_id` + `status`
- Backfills `AMNT-*` into `ast_document_sequence`

## 2. Workflow governance

**Production:** `ASSET_WORKFLOW_GOVERNANCE_ENABLED=true`

Confirm `AST_MAINTENANCE_APPROVAL` exists per tenant (seeded in `0266`).

## 3. Application deploy

1. Deploy API + web.
2. Smoke: create WO → submit → approve (2 steps) → schedule → start (asset `in_maintenance`) → complete (asset `active`, history row).
3. Confirm `asset.maintenance:update` on manager/admin/executive roles.

## 4. Finance boundary

Maintenance does **not** post GL (ADR MNT-08). `cost_amount` is operational only.

## 5. Accepted risk — open work-order exclusivity

Exclusivity (one open WO per asset) is enforced in application code. The partial index `ix_ast_asset_maintenance_asset_status_open` speeds lookups; it is **not** UNIQUE. Do not rely on the database alone to prevent concurrent duplicate open work orders. On rare race conflicts, the second request may succeed; remediate operationally or retry. Reopen re-validates exclusivity so a cancelled WO cannot be reopened while another open WO exists.
