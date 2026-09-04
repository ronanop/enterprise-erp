# CR-004 — Architecture Decision Log

**Phase:** 1.1 — Architecture Lock  
**Status:** LOCKED (documentation only; no code)  
**Baseline:** Platform Architecture Lock v1.1 + CR-004 Phase 1  
**Date:** 2026-08-03

---

## Phase 1 consistency review (Task 1)

| Area | Finding | Resolution (locked) |
|------|---------|---------------------|
| Enum naming | Phase 1 used `OperationalStatus` / `OperationalStatusEngine` interchangeably | **Locked names:** `AssetOperationalStatus`, `AssetOperationalStatusEngine` |
| Admin “mark retired” vs no PATCH | Roadmap mentioned admin endpoints; Task 1.1 forbids direct PATCH | **Dedicated transition commands only** (`POST .../operational-transitions/{action}` or service methods)—never `operational_status` on generic asset update |
| Current Holder vs `custodian_employee_id` | Assignment SSOT listed denormalized custodian | **IT Current Holder is derived** from active assignment; `custodian_employee_id` remains FP-ASSET sync mirror, not CR-004 authority |
| `PENDING_DISPOSAL` → `READY_TO_MOVE` | Transition matrix allows conditional reinstate | **Locked:** only via explicit **Reinstate** business command after maintenance policy (Phase 3+); not silent PATCH |
| CR-001 category guard | Architecture noted ambiguity for RETIRED | **Locked:** CR-001 guard **unchanged**—uses existing `count_operational_by_category` on registration `status`; ops status does not alter CR-001 |
| Service naming | Phase 1 allowed `AssetService` methods | **Locked:** `AssetOperationalStatusService` as sole writer (thin wrapper acceptable inside asset module) |
| Sidebar optional item | Architecture mentioned optional IT Inventory link | **Locked:** no new sidebar items; filtered views only |

No unresolved conflicts remain for implementation.

---

## Decision register

### D-001 — Operational status persistence

| | |
|--|--|
| **Decision** | Operational Status |
| **Result** | Dedicated column `ast_asset.operational_status` |
| **Reason** | Separate IT operations workflow from registration/finance lifecycle (`ast_asset.status`). Single SSOT per asset row. Indexable for branch inventory. |

**WILL NOT** reuse `ast_asset.status` for IT Excel buckets.

---

### D-002 — Operational status domain model

| | |
|--|--|
| **Decision** | Operational Status |
| **Implementation** | Domain enum **`AssetOperationalStatus`** (`READY_TO_MOVE`, `ASSIGNED`, `RETIRED`, `PENDING_DISPOSAL`, `DISPOSED`) |
| **Reason** | Prevent string literals; explicit domain concept independent of `AssetStatus`. |

**Not implemented in Phase 1.1** — documented for Phase 2+.

---

### D-003 — Lifecycle vs operational status

| | |
|--|--|
| **Decision** | Two orthogonal status dimensions |
| **Result** | `AssetStatus` (existing) + `AssetOperationalStatus` (new) |
| **Reason** | Registration workflow (`draft`→`active`→`disposed`) must not be overloaded with IT ops. |

Operational Status **is its own domain concept**.

---

### D-004 — Transition ownership

| | |
|--|--|
| **Decision** | Transition Ownership |
| **Implementation** | **`AssetOperationalStatusEngine`** + **`AssetOperationalStatusValidator`** + **`AssetOperationalStatusService`** |
| **Reason** | Single transition authority; matrix enforcement in one place. |

**ONLY** approved business workflows may change operational status:

| Workflow | Transitions |
|----------|-------------|
| Assignment activate | → `ASSIGNED` |
| Assignment return | → `READY_TO_MOVE` |
| Retire command | → `RETIRED` |
| Mark not working command | → `PENDING_DISPOSAL` |
| Reinstate command (policy) | `PENDING_DISPOSAL` → `READY_TO_MOVE` |
| Disposal post | → `DISPOSED` |
| Registration activate (IT policy) | → `READY_TO_MOVE` (initial) |

**Forbidden:** Direct PATCH/PUT of `operational_status` on asset registration update, discovery apply, or bulk import without transition service.

---

### D-005 — Engine responsibilities

| | |
|--|--|
| **Decision** | Engine Ownership |
| **Implementation** | **`AssetOperationalStatusEngine`** |
| **Reason** | Pure domain rules; testable without DB. |

**Responsibilities (locked):**

- Validate allowed transitions per `CR-004-Transition-Matrix.md`
- Reject blocked and terminal violations (`DISPOSED` outbound)
- No persistence
- No HTTP
- No repository access

Persistence only via `AssetOperationalStatusService` → `AssetRepository`.

---

### D-006 — Sidebar & navigation

| | |
|--|--|
| **Decision** | Sidebar |
| **Implementation** | **Filtered views** on existing register (`/assets/assets?ops=...`) |
| **Reason** | Single route SSOT; locked sidebar unchanged; Excel tabs = filters not menus. |

---

### D-007 — Discovery (CR-003)

| | |
|--|--|
| **Decision** | Discovery |
| **Implementation** | **Read-only** for operational status; apply allowlist unchanged |
| **Reason** | Discovery enriches hardware only (`discovery_profile_json`, serial). |

---

### D-008 — Information Portal (CR-002)

| | |
|--|--|
| **Decision** | Portal |
| **Implementation** | Display `operational_status` read-only when implemented |
| **Reason** | No portal write path; preserves CR-002. |

---

### D-009 — Transition API shape

| | |
|--|--|
| **Decision** | No direct field PATCH |
| **Implementation** | Additive **transition endpoints** or RPC-style POST actions invoking `AssetOperationalStatusService` |
| **Reason** | Enforces audit + engine; prevents UI bypass. |

---

### D-010 — Assignment enrichment

| | |
|--|--|
| **Decision** | Delivery challan & remarks |
| **Implementation** | `ast_asset_assignment` columns (Phase 5); optional document FK |
| **Reason** | Issue-specific data belongs on assignment document, not asset row. |

---

### D-011 — Components & accessories

| | |
|--|--|
| **Decision** | Charger / other items |
| **Implementation** | Existing **`ast_asset_component`** |
| **Reason** | No duplicate accessory table. |

---

### D-012 — Branch inventory

| | |
|--|--|
| **Decision** | Branch dimension |
| **Implementation** | Existing **`branch_id`** on `ast_asset` + filters |
| **Reason** | No branch inventory table; counts are queries. |

---

### D-013 — Operational Timeline

| | |
|--|--|
| **Decision** | Historical ops audit trail UI |
| **Implementation** | **Future scope** (Phase 8+ / post CR-004) |
| **Reason** | Audit engine + transition logs sufficient for v1; timeline is UX enhancement. |

See `CR-004-Implementation-Roadmap.md` — Future enhancements.

---

### D-014 — Current Holder (IT)

| | |
|--|--|
| **Decision** | Current Holder |
| **Implementation** | **Always derived** at read time |
| **Reason** | Prevent drift vs assignment. |

**Derivation rule (locked):**

```text
IF operational_status == ASSIGNED
   AND exists active assignment (employee allocation)
THEN current_holder = employee from assignment (join master_employee)
ELSE current_holder = null / "—" / "Unassigned"
```

Do **not** introduce `current_holder_id` column.  
Existing `custodian_employee_id` may mirror assignment for legacy FP-ASSET paths but **must not** be treated as IT SSOT for CR-004 UI/reports.

---

## Single Source of Truth lock (Task 7)

| Concept | Owner | Storage | Notes |
|---------|-------|---------|-------|
| Asset Register | Asset module | `ast_asset` | One row per device |
| Operational Status | Asset module | `ast_asset.operational_status` | Written only via transition service |
| Registration lifecycle | Asset module | `ast_asset.status` | Existing engines |
| Assignment | Asset module | `ast_asset_assignment` | Custody documents |
| Employee ID / name | Master Data | `master_employee` | Never copy to asset |
| Phone | Master Data | `master_employee` | Derived |
| Brand / model | Master + discovery | `product_id`, adapters, discovery JSON | Derived in portal/reports |
| Configuration | Discovery (CR-003) | `discovery_profile_json` | Apply allowlist only |
| Components | Asset module | `ast_asset_component` | Accessories |
| Previous user | Assignment history | Prior assignment rows | Derived query |
| Delivery challan | Assignment (Phase 5) | `delivery_challan_ref` | Not on asset |
| Current Holder | **Derived** | — | Active assignment + `ASSIGNED` |
| Branch | Organization | `org_branch` / `branch_id` | Filter dimension |

**No duplicated ownership.**

---

## Approval

| Role | Phase 1.1 |
|------|-----------|
| Architecture | Locked pending stakeholder sign-off |
| Implementation | Blocked until Phase 2 kickoff |

**Next document:** `CR-004-Architecture-Recommendation.md` (§ Architecture Lock)  
**Next phase:** Phase 2B-2+ — HTTP transition commands, assignment/disposal hooks, audit wiring

---

## Phase 2B-1 implementation note (2026-08-03)

| Item | Status |
|------|--------|
| `AssetOperationalStatusEngine` | Implemented — pure rules in `operational_status_rules.py` |
| `OperationalStatusValidator` | Implemented — no persistence |
| `AssetOperationalStatusService` | Implemented — internal only; no routes |
| Repository `set_operational_status` | Implemented — persist only, no validation |
| Phase 2B-1 transition matrix | **Subset** of full matrix: five allowed edges only (see `CR-004-Phase-2B1-Business-Layer.md`) |
| Audit event names | Constants only; no Audit engine calls |
| Assignment / disposal hooks | **Integrated** (Phase 2B-2) |

---

## Phase 2B-2 implementation note (2026-08-03)

| Item | Status |
|------|--------|
| Assignment activate → `assign` | `AssignmentService._activate_assignment` |
| Return good / outdated / dead | `return_assignment(return_condition=...)` |
| Disposal post → `complete_disposal` | `DisposalService.post` |
| Registration → `READY_TO_MOVE` | `AssetService` approve paths |
| Audit fields | `operational_status_audit.log_operational_status_change` |
| `OperationalStatusConflict` | Version guard on persist |
