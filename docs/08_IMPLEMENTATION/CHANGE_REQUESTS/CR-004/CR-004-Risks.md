# CR-004 — Risks & Mitigations

**Phase:** 1 — Documentation only

---

## Architecture risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Overloading `ast_asset.status` with IT ops | Breaks engines/validators | Separate `operational_status` column |
| UI writes ops status directly | Drift, audit gaps | Single service + engine |
| Discovery apply widened allowlist | CR-003 violation | Explicit deny in validator |
| Duplicate register table | SSOT failure | Forbidden in ADR |

---

## Migration risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backfill assigns wrong ops status | Wrong Excel bucket counts | Rule: active assignment → ASSIGNED else READY_TO_MOVE |
| Legacy disposed assets | Mixed states | Map `asset.status disposed` → ops DISPOSED |
| NULL ops during rollout | Filter gaps | Feature flag + default on activate |

---

## Backward compatibility

| Risk | Mitigation |
|------|------------|
| API clients ignore new field | Optional response field |
| Existing integrations use `status` only | Document dual-status model |
| Category operational count (CR-001) | Define whether RETIRED counts |

---

## Status synchronization

| Risk | Mitigation |
|------|------------|
| `ASSIGNED` without active assignment | Reconciliation job; validator on read |
| Custodian cleared but ops ASSIGNED | Hook on return only via service |
| Double assignment | Existing assignment validators + ops gate |

---

## Assignment conflicts

| Risk | Mitigation |
|------|------------|
| Assign retired asset | Block in `AssignmentValidator` |
| Assign pending disposal | Block |
| Transfer while assigned | Existing transfer rules + ops check |

---

## Scalability & performance

| Risk | Mitigation |
|------|------------|
| Branch + ops filters on large register | Composite index |
| Dashboard N+1 queries | Aggregate queries in report engine |

---

## Incomplete workspaces (report only)

| Area | Note |
|------|------|
| `assetRegisterService` FE export | Pre-existing; may block some UI until restored |
| Asset Types workspace | UI catalog; not full MDM |
| Settings workspace | Module prefs; scope TBD in Phase 6 |

**Do not implement missing business features in Phase 1.**
