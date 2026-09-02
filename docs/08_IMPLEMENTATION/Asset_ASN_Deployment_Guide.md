# Asset Assignment — Deployment Guide (FP-ASSET-003)

## 1. Migrations

Apply through head including:

- `0468_ast_assignment_governance`

```bash
cd apps/api
alembic upgrade head
```

### 0468 contents

- Seeds `asset.assignment:update` and grants to Asset roles
- Partial index on pending/active assignments by `asset_id` + `status`
- Backfills `AASN-*` into `ast_document_sequence`

Downgrade drops index and removes the update permission. Prefer forward-fix in production.

## 2. Workflow governance

**Production:** `ASSET_WORKFLOW_GOVERNANCE_ENABLED=true`

Confirm `AST_ASSIGNMENT_APPROVAL` exists per tenant (seeded in `0266`).

Legacy single-call approve+activate when flag is false is **non-production only**.

## 3. Application deploy

1. Deploy API + web.
2. Smoke: create employee assignment draft → submit → three approves → active (custodian set) → return (custodian cleared).
3. Confirm `asset.assignment:update` on manager/admin roles.

## 4. Finance boundary

Assignment does **not** post GL (ADR ASN-001).

## 5. Implementation notes (remediation)

### `cancel_draft` validation order

`AssignmentService.cancel_draft` validates `workflow_instance_id is None` **before** calling `AssetAssignmentEngine.cancel_draft`. This is behaviour-preserving versus the prior Assignment path (engine would still reject non-draft states) and safer than mutating in-memory state when cancel is illegal. Transfer retains validate-after-engine for historical parity; Assignment intentionally improved because the check does not depend on engine side effects.
