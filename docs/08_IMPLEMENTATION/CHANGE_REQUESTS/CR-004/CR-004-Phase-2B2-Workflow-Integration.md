# CR-004 Phase 2B-2 — Workflow Integration

**Date:** 2026-08-03  
**Scope:** Wire `AssetOperationalStatusService` into registration, assignment, return, and disposal. Audit + optimistic locking. **No** UI, dashboard, sidebar, or new routes.

---

## Preparation

| Check | Result |
|-------|--------|
| Review `CR-004-Decision-Log.md` | Done |
| Workflow ownership matrix | `CR-004-Workflow-Ownership-Matrix.md` |
| Direct `operational_status` writes outside service | **None** (only migration, ORM, repository `set_operational_status`, tests) |

---

## Integrations

### Registration (`AssetService`)

After registration activate / legacy approve → `initialize_ready_to_move()` (initial seed, not matrix edge).

### Assignment (`AssignmentService`)

`_activate_assignment` → `apply_action("assign")` with asset `expected_version`.

### Return (`AssignmentService`)

`return_assignment(..., return_condition=good|outdated|dead)` → operational action before assignment engine return.

| `return_condition` | Action |
|--------------------|--------|
| `good` | `return_to_ready` |
| `outdated` | `retire` |
| `dead` | `mark_pending_disposal` |

### Disposal (`DisposalService`)

`post()` after lifecycle dispose sync → `apply_action("complete_disposal")` (requires `PENDING_DISPOSAL` per engine).

---

## Audit

`service/operational_status_audit.py` — `log_operational_status_change()` using `OperationalStatusAuditEvent` operation names. Emitted **after** successful `set_operational_status`.

---

## Concurrency

- `lock_for_update` + `expected_version` on asset row.
- `OperationalStatusConflict` on version mismatch.

---

## Tests

```bash
cd apps/api
pytest src/tests/unit/asset/test_operational_status_workflow_integration.py \
  src/tests/unit/asset/test_assignment_return_condition.py \
  src/tests/unit/asset/test_asset_operational_status_service.py \
  src/tests/unit/asset/test_disposal_service.py \
  src/tests/unit/asset/test_asset_repository_operational_status.py -q
```

Integration fixtures: `insert_active_asset(..., operational_status=...)`; disposal post tests use `PENDING_DISPOSAL`.

---

## Out of scope

Dashboard, sidebar, reports, frontend, QR, discovery, components, category changes.

---

## Next phase

Optional HTTP transition commands and read API exposure (per roadmap).
