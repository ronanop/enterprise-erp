# CR-004 Phase 2B-1 — Business Layer (Operational Status)

**Scope:** Domain engine, validator, internal service, repository persist helper, audit event names. **No** routes, APIs, assignment/disposal hooks, or UI.

**Date:** 2026-08-03

---

## 1. Components

| Layer | Type | Path |
|-------|------|------|
| Rules (SSOT) | Domain | `domain/operational_status_rules.py` |
| Exceptions | Domain | `domain/operational_status_exceptions.py` |
| Audit names | Domain | `domain/operational_status_audit_events.py` |
| Engine | Service / engines | `service/engines/asset_operational_status_engine.py` |
| Validator | Service | `service/operational_status_validator.py` |
| Service | Service | `service/asset_operational_status_service.py` |
| Repository | Infra | `repository/asset_repository.py` — `set_operational_status()` |

Flow (internal):

```text
AssetOperationalStatusService
    → OperationalStatusValidator
    → AssetOperationalStatusEngine
    → AssetRepository.set_operational_status()
```

`AssetRepository.update()` still strips `operational_status` (generic PATCH path).

---

## 2. Business rules (Phase 2B-1 matrix)

### Allowed

| From | To |
|------|-----|
| `READY_TO_MOVE` | `ASSIGNED` |
| `ASSIGNED` | `READY_TO_MOVE` |
| `ASSIGNED` | `RETIRED` |
| `ASSIGNED` | `PENDING_DISPOSAL` |
| `PENDING_DISPOSAL` | `DISPOSED` |

### Explicitly blocked (documented)

| From | To | Reason |
|------|-----|--------|
| `READY_TO_MOVE` | `DISPOSED` | Must go through assignment/disposal workflows (later phases) |
| `READY_TO_MOVE` | `RETIRED` | Retire only from assigned custody in this phase |
| `DISPOSED` | * | Terminal — no outbound transitions |
| `RETIRED` | `ASSIGNED` | Violates retire policy |
| `RETIRED` | `READY_TO_MOVE` | Violates “never assign again” |

All other pairs not in the allowed set are rejected with `InvalidTransition`.

### Terminal behavior

- **`DISPOSED`:** any change raises `TerminalState` (except no-op same-state → `InvalidTransition`).
- **`RETIRED`:** no outbound transitions in Phase 2B-1 allowed set (e.g. `RETIRED` → `PENDING_DISPOSAL` deferred to later phase).

### Named actions (validator only; no HTTP yet)

| Action | Target status |
|--------|----------------|
| `assign` | `ASSIGNED` |
| `return_to_ready` | `READY_TO_MOVE` |
| `retire` | `RETIRED` |
| `mark_pending_disposal` | `PENDING_DISPOSAL` |
| `complete_disposal` | `DISPOSED` |

---

## 3. Exceptions

| Type | Use |
|------|-----|
| `OperationalStatusException` | Base |
| `InvalidTransition` | Disallowed edge / no-op |
| `TerminalState` | Mutation from `DISPOSED` |
| `UnknownOperationalStatus` | NULL or unknown string |
| `InvalidOperationalAction` | Unknown action name |
| `AssetNotFoundForOperationalStatus` | Missing asset on persist |

---

## 4. Audit (prepared only)

`OperationalStatusAuditEvent`: `OperationalStatusChanged`, `AssignmentReturned`, `Retired`, `Disposed` — **not** wired to Audit engine in 2B-1.

---

## 5. Tests

```bash
cd apps/api
pytest src/tests/unit/asset/test_asset_operational_status_engine.py \
  src/tests/unit/asset/test_operational_status_validator.py \
  src/tests/unit/asset/test_asset_operational_status_service.py \
  src/tests/unit/asset/test_operational_status_exceptions.py \
  src/tests/unit/asset/test_operational_status_transition_matrix.py \
  src/tests/unit/asset/test_operational_status_audit_events.py \
  src/tests/unit/asset/test_asset_repository_operational_status.py -q
```

---

## 6. Out of scope (unchanged)

Assignment integration, disposal integration, routers, dashboards, sidebar, reports, frontend, audit emission.

---

## 7. Next phase

Expose transition commands via router; hook assignment/disposal services; audit integration (per roadmap).
