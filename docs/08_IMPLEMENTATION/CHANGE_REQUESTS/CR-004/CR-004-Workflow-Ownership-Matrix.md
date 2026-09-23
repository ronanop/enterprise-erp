# CR-004 — Workflow Ownership Matrix

**Status:** LOCKED (Phase 2B-2)  
**Rule:** All `operational_status` changes go through `AssetOperationalStatusService` only.

| Workflow event | Owner service | Operational action | Target status |
|----------------|---------------|--------------------|---------------|
| Register asset approved / activated | `AssetService` | `initialize_ready_to_move` | `READY_TO_MOVE` |
| Assignment activated | `AssignmentService` | `assign` | `ASSIGNED` |
| Return — good condition | `AssignmentService` | `return_to_ready` | `READY_TO_MOVE` |
| Return — outdated | `AssignmentService` | `retire` | `RETIRED` |
| Return — dead / not working | `AssignmentService` | `mark_pending_disposal` | `PENDING_DISPOSAL` |
| Disposal posted (completion) | `DisposalService` | `complete_disposal` | `DISPOSED` |

## Forbidden

- Setting `ast_asset.operational_status` in routers, validators, engines, or generic `AssetRepository.update()`.
- Bypassing `AssetOperationalStatusService` from assignment, disposal, or registration flows.

## Audit

Each successful transition logs via `log_operational_status_change` with old/new status, action, user, timestamp, reason, remarks.

## Concurrency

`expected_version` on asset row (optimistic lock) — conflicts raise `OperationalStatusConflict`.
