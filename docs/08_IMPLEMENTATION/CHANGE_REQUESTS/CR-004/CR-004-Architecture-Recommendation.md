# CR-004 — Architecture Recommendation

**Constraint:** Architecture Lock v1.1 — Router → Service → Validator → Engine → Repository. No cross-module DB access.

**Phase 1.1:** Architecture decisions below are **LOCKED**. See `CR-004-Decision-Log.md`.

---

## Architecture Lock (CR-004)

### Operational status is a separate domain concept

| Dimension | Enum / field | Purpose |
|-----------|--------------|---------|
| Registration / finance lifecycle | `AssetStatus` → `ast_asset.status` | Draft, approval, active, maintenance, disposed (FP-ASSET) |
| IT operations | **`AssetOperationalStatus`** → `ast_asset.operational_status` | Excel buckets: ready, assigned, retired, pending disposal, disposed |

**Operational Status WILL NOT reuse `ast_asset.status`.**  
Mixing the two dimensions is **forbidden**.

### Transition ownership

- **Only** business workflows change operational status (assign, return, retire, mark not working, reinstate, disposal post, IT registration activate default).
- **`AssetOperationalStatusEngine`** — allowed/blocked transitions, terminal rules; no I/O.
- **`AssetOperationalStatusValidator`** — cross-check assignment, disposal, registration state.
- **`AssetOperationalStatusService`** — **sole writer** to `operational_status`.
- **Direct PATCH** of `operational_status` on generic asset update APIs is **forbidden**. Use transition commands only (D-009).

### Naming (locked)

| Artifact | Name |
|----------|------|
| Domain enum | `AssetOperationalStatus` |
| Engine | `AssetOperationalStatusEngine` |
| Service | `AssetOperationalStatusService` |
| Column | `operational_status` |

### Current Holder

- **Derived only** — never stored.
- Source: active employee assignment when `operational_status == ASSIGNED`.
- `custodian_employee_id` remains legacy denormalization; not IT SSOT (D-014).

### Discovery & portal

- Discovery: **read-only** for ops status; CR-003 allowlist unchanged.
- Portal: **read-only** display when field exists.

### Navigation

- Locked sidebar unchanged.
- Excel equivalents = **filtered register views**.

### Future (not in CR-004 core)

- **Operational Timeline** UI — audit-based history presentation (post Phase 7).

---

## 1. Data model: operational status

### Decision: **new column on `ast_asset`** (LOCKED D-001)

| Option | Verdict |
|--------|---------|
| Reuse `ast_asset.status` | **Reject** |
| New table | **Reject** |
| JSON in discovery profile | **Reject** |
| **`operational_status` column** | **Accept** |

- Type: `VARCHAR(30)` + CHECK for five `AssetOperationalStatus` values
- Default/backfill: Phase 2 migration rules
- Nullable during rollout for non-IT assets

**Do not** create a second asset register table.

---

## 2. Optional additive fields (Phase 5)

| Field | Table | Purpose |
|-------|-------|---------|
| `delivery_challan_ref` | `ast_asset_assignment` | Excel challan |
| `remarks` | `ast_asset_assignment` | Issue remarks |
| `retired_at` / `retired_reason` | `ast_asset` | Audit metadata for RETIRED (optional) |

---

## 3. Service design (LOCKED)

```text
Router (thin)
  → AssetOperationalStatusService.transition_*()
      → AssetOperationalStatusValidator
      → AssetOperationalStatusEngine
      → AssetRepository.update(operational_status=...)

AssignmentService / DisposalService / Registration activate
  → invoke AssetOperationalStatusService (hooks)
```

| Caller | Transition |
|--------|------------|
| Assignment activate | `ASSIGNED` |
| Assignment return | `READY_TO_MOVE` |
| Retire command | `RETIRED` |
| Not working command | `PENDING_DISPOSAL` |
| Reinstate command | `PENDING_DISPOSAL` → `READY_TO_MOVE` (policy) |
| Disposal post | `DISPOSED` |
| Registration activate (IT) | `READY_TO_MOVE` |

### Read APIs (additive)

- Filter `operational_status` on list/search
- Response DTO includes read-only field
- Portal includes read-only label

---

## 4. Frontend architecture

### Workspaces — impact summary

(Unchanged from Phase 1; all enhancements respect Architecture Lock above.)

| Workspace | Ops status impact |
|-----------|-------------------|
| Register | Column + filters; Current Holder derived column |
| Assignment | Transition triggers; no manual ops field on form |
| Transfers / Maintenance | Gates + filters |
| Discovery | No write |
| Portal / QR | Read-only label |
| Reports | Branch + ops aggregates |
| Disposal | Drives `DISPOSED` |
| Master data | No ops on categories/types |

### Views vs routes

`/assets/assets?ops=READY_TO_MOVE|ASSIGNED|RETIRED|PENDING_DISPOSAL`

---

## 5. Dashboard (IT Admin)

Branch-scoped KPIs + quick links to filtered views; no finance-heavy default.

---

## 6. API compatibility

Additive column, filters, transition endpoints. No breaking changes.

---

## 7. Diagram

```text
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ Sidebar /   │────▶│ Filtered register    │────▶│ Existing        │
│ Dashboard   │     │ views                │     │ workspaces      │
└─────────────┘     └──────────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┘
                        ▼
              ┌──────────────────────────────┐
              │ AssetOperationalStatusService │
              │ + Validator + Engine          │
              └─────────────┬────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
 AssignmentService   DisposalService    Transition routers
 (hooks)              (hook)             (retire / not-working / reinstate)
```

---

## 8. CR regression guardrails (LOCKED)

| CR | Guardrail |
|----|-----------|
| CR-001 | Category guard uses registration `status` only — **not** ops status |
| CR-002 | Portal read-only |
| CR-003 | Discovery apply excludes `operational_status` |
