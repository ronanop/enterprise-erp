# Asset Transfer — Deployment Guide (FP-ASSET-002)

## 1. Migrations

Apply in order:

1. `0465_ast_document_sequence` (if not already applied)
2. `0466_ast_transfer_governance`
3. `0467_ast_transfer_pending_index`

Verify:

```bash
cd apps/api
alembic upgrade head
```

### Downgrade limitations (0466)

Downgrading `0466` is **destructive** for in-flight transfers:

- Rows with `status` in (`submitted`, `approved`) **violate** the restored CHECK (`draft`, `completed`, `cancelled` only).
- Workflow columns and `AST_TRANSFER_APPROVAL` definition are removed.
- Downgrade **re-seeds** `asset.transfer:complete` for `ASSET_MANAGER` and `ASSET_ADMIN` (legacy clients only).

**Recommended:** Do not downgrade 0466 in production; forward-fix data instead.

Downgrading `0467` only drops the pending-transfer index.

## 2. Workflow governance (production)

**Production requirement:** `ASSET_WORKFLOW_GOVERNANCE_ENABLED=true`

- Staging/UAT: enable after `0266` / `0466` workflow seeds and notification templates (`AST_WF_*`) are verified.
- Development: may use `false` for local speed; `TransferService._legacy_approve` is **non-production only** (single-call submit+execute without `wf_instance`).

Default in `core/config.py` remains `false` per ADR-ASSET-WF-GOV-001 (opt-in per environment via env var).

## 3. Application deploy

1. Deploy API + web.
2. Smoke: `GET /api/v1/assets/asset-transfers`, create draft, submit, three approve steps, confirm asset branch/location updated.
3. Confirm `asset.transfer:complete` is not assigned to production roles (removed by 0466 upgrade).

## 4. Finance boundary

Transfer execution does **not** post GL (ADR TRF-04).
