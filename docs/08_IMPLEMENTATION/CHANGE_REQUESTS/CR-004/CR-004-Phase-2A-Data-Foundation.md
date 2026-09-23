# CR-004 Phase 2A — Data Foundation (Operational Status)

**Scope:** Data layer only. No engine, validator, transition service, APIs, routes, frontend, or assignment/disposal hooks.

**Date:** 2026-08-03

---

## 1. Domain enum

| Item | Location |
|------|----------|
| `AssetOperationalStatus` | `apps/api/src/modules/asset/domain/enums.py` |
| `ASSET_OPERATIONAL_STATUS_VALUES` | Same file (frozenset for CHECK / validation in later phases) |

| Value | Meaning (future workflows) |
|-------|----------------------------|
| `READY_TO_MOVE` | Available for assignment / movement |
| `ASSIGNED` | Active assignment exists |
| `RETIRED` | Not set by backfill |
| `PENDING_DISPOSAL` | Not set by backfill |
| `DISPOSED` | Lifecycle disposed / written off |

Operational status is **orthogonal** to `AssetStatus` (`ast_asset.status`).

---

## 2. Database

| Change | Detail |
|--------|--------|
| Table | `asset.ast_asset` |
| Column | `operational_status VARCHAR(30) NULL` |
| Index | `ix_asset_ast_asset_operational_status` |
| CHECK | `ck_ast_asset_operational_status` — NULL or one of the five enum values |

**Migration:** `apps/api/alembic/versions/0486_ast_operational_status.py`  
**Revises:** `0485_ast_discovery_profile`

---

## 3. ORM

`AstAsset.operational_status` added in `apps/api/src/modules/asset/models/asset.py`.  
Lifecycle `status` unchanged.

---

## 4. Backfill strategy

Applied in migration (idempotent SQL) and mirrored in Python for tests:

| Order | Condition | `operational_status` |
|-------|-----------|----------------------|
| 1 | `status IN ('disposed','written_off')` | `DISPOSED` |
| 2 | Not disposed AND active assignment (`ast_asset_assignment.status = 'active'`, not deleted) | `ASSIGNED` |
| 3 | Remaining non-deleted rows with NULL column | `READY_TO_MOVE` |

**Not inferred:** `RETIRED`, `PENDING_DISPOSAL`.

Helper: `apps/api/src/modules/asset/domain/operational_status_backfill.py` → `backfill_operational_status_value()`.

---

## 5. Repository (read only)

| Behavior | Detail |
|----------|--------|
| Read | `AssetRepository.get()` returns full row including `operational_status` |
| Read helper | `get_operational_status(ctx, asset_id)` |
| Writes | `update()` **strips** `operational_status` from kwargs (no accidental transitions) |
| No filtering / search changes | Per Phase 2A scope |

---

## 6. Explicitly out of scope (Phase 2A)

- `AssetOperationalStatusEngine` / `AssetOperationalStatusService`
- Transition endpoints or PATCH of operational status
- API response fields (`AssetResponse` unchanged)
- Assignment, return, disposal hooks
- Dashboard, sidebar, reports

---

## 7. Tests

| File | Coverage |
|------|----------|
| `test_asset_operational_status_enum.py` | Enum values + frozenset |
| `test_operational_status_backfill.py` | Backfill rules; no RETIRED/PENDING |
| `test_operational_status_migration.py` | Revision chain + constants |
| `test_asset_repository_operational_status.py` | Read helper; update strips writes |

---

## 8. Validation

```bash
cd apps/api
pytest src/tests/unit/asset/test_asset_operational_status_enum.py \
  src/tests/unit/asset/test_operational_status_backfill.py \
  src/tests/unit/asset/test_operational_status_migration.py \
  src/tests/unit/asset/test_asset_repository_operational_status.py -q
```

Apply migration when DB is ready:

```bash
cd apps/api
alembic upgrade head
```

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Long Alembic revision IDs vs `alembic_version.version_num` length | Extend column or use shorter revision ids before upgrade in affected envs |
| Backfill assigns `ASSIGNED` from any active assignment row | Aligns with Phase 2A rules; transition engine will own future corrections |
| NULL `operational_status` after partial migration | Re-run upgrade; third UPDATE fills NULLs for non-disposed rows |

---

## 10. Next phase (reference)

Per `CR-004-Decision-Log.md` and roadmap: engine + service + transition commands + read API exposure (not in 2A).
