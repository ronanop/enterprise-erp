# CR-004 — Implementation Roadmap

**Phase 1:** Analysis — Complete  
**Phase 1.1:** Architecture Lock — Complete (`CR-004-Decision-Log.md`)  
**Phases 2–7:** Implementation (not started)

---

## Phase 2 — Backend foundation (data + read model)

**Goal:** Persist operational status **without transition behavior** or user-facing commands.

| Deliverable | Architecture lock compliance |
|-------------|------------------------------|
| Alembic: `operational_status` on `ast_asset` + CHECK (`AssetOperationalStatus` values) | D-001 |
| Domain enum **`AssetOperationalStatus`** in `domain/enums.py` | D-002 (code in Phase 2) |
| Backfill: active register + active assignment → `ASSIGNED`, else `READY_TO_MOVE`; disposed → `DISPOSED` | Transition matrix §4 |
| **Read-only** exposure on `AssetResponse` / list filters | Additive API only |
| **No** transition engine, **no** transition endpoints, **no** PATCH of ops field | D-004, D-009 |

**Preparation (documentation only, done in 1.1):** Decision log, SSOT, matrix locked.

**Exit criteria:** Column + enum exist; reads work; writes still impossible from API; all tests green.

**Phase 2 readiness:** ✅ Can proceed without changing Architecture Lock v1.1 or CR-004 lock.

---

## Phase 3 — Operational status engine & workflow hooks

**Goal:** Enforce transition matrix; sole write path.

| Deliverable | Notes |
|-------------|-------|
| **`AssetOperationalStatusEngine`** | D-005 |
| **`AssetOperationalStatusValidator`** | Assignment/disposal/register gates |
| **`AssetOperationalStatusService`** | Sole writer |
| Hooks: `AssignmentService` activate/return | D-004 |
| Hook: `DisposalService` post → `DISPOSED` | D-004 |
| **Transition routes:** retire, mark-not-working, reinstate (POST actions) | **Not** asset PATCH |
| Audit on every transition | Platform audit engine |
| Block `operational_status` in registration/discovery update allowlists | D-007 |

**Exit criteria:** Matrix enforced; direct PATCH rejected by validator/tests.

---

## Phase 4 — IT register UX (filtered views)

**Goal:** Replace Excel tabs.

| Deliverable | Notes |
|-------------|-------|
| Register presets: Ready / Assigned / Retired / Pending disposal | D-006 |
| Branch filter (Noida, Mumbai, Dubai) | D-012 |
| Ops column + **Current Holder** derived column | D-014 |
| Portal read-only ops label | D-008 |
| Assignment UI blocks when ops forbids | Validator messages |

**Exit criteria:** IT Admin daily ops without Excel tabs.

---

## Phase 5 — Assignment enrichment

| Deliverable | Notes |
|-------------|-------|
| `remarks`, `delivery_challan_ref` on assignment | D-010 |
| “Earlier used by” history panel | Derived |
| Component shortcuts from register | D-011 |

---

## Phase 6 — IT dashboard

| Deliverable | Notes |
|-------------|-------|
| Branch-scoped KPI cards (5 ops buckets) | |
| Quick actions → filtered routes + transition entry points | |
| Recent assignments | Existing APIs |

---

## Phase 7 — Reporting, import, hardening

| Deliverable | Notes |
|-------------|-------|
| IT asset register / branch inventory report keys | |
| Reconciliation job (ops vs assignment) | |
| Optional Excel import (one-time) | |
| Index `(branch_id, operational_status)` | |
| Full CR-001/002/003 + FP-ASSET regression | |

---

## Future enhancements (post Phase 7 — NOT in scope)

| Enhancement | Description |
|-------------|-------------|
| **Operational Timeline** | UI timeline of ops transitions from audit logs (D-013) |
| Deprecate custodian-only displays | Full migration to derived Current Holder |
| Auto-reinstate from maintenance completion | Policy workflow |

---

## Sidebar (locked)

No new sidebar items. Excel buckets = filters on **All Assets**.

---

## Dependency graph

```text
Phase 1.1 (lock) → Phase 2 → Phase 3 → Phase 4
                              ↓
                         Phase 5 → Phase 6 → Phase 7 → Future (Timeline)
```

---

## Effort (relative)

| Phase | Effort |
|-------|--------|
| 2 | S |
| 3 | M |
| 4 | M |
| 5 | S |
| 6 | S |
| 7 | M |
