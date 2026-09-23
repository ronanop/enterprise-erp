# CR-004 — Frontend Implementation Plan (Phases 3.2–3.5)

**Prerequisite:** Phase 3.1 design freeze approved.  
**Constraint:** No backend changes unless separate CR; use APIs in Phase 2C mapping.

---

## Phase 3.2 — Shared UI foundation ✅

**Goal:** Reusable components in `components/assets/shared/` (StatCard, QueueCard, StatusBadge, BranchSelector, InventoryFilterBar, QuickActionCard, EmptyState, skeletons).

**Status:** Complete. Vitest + Testing Library added to `apps/web`.

---

## Phase 3.3A — Asset Operations layout ✅

**Goal:** `AssetOperationsDashboard` visual layout only — header, KPI row, quick actions, three queue cards.

| Work item | Detail |
|-----------|--------|
| Component | `asset-operations-dashboard.tsx` |
| KPI default | Loading skeletons; optional demo placeholder values |
| Queues | Static placeholder rows |
| Branch | Local state via `BranchSelector` |
| Header | Notification + profile placeholders |

**Status:** Complete. **No** route swap, API, or navigation.

---

## Phase 3.3B — Dashboard data & route ✅

**Goal:** Mount layout on `/assets` and wire live data.

| Work item | Detail |
|-----------|--------|
| `AssetOperationsContainer` | Parallel fetch, loading/error/empty |
| `dashboard.mapper.ts` | DTO → KPI + queue rows |
| `assetOperationsService` | `dashboard-summary`, asset list, assignments |
| Route | `/assets` uses container |
| Tests | Mapper + fetch + container + dashboard |

**Status:** Complete.

---

## Phase 3.4A — Inventory foundation ✅

**Goal:** One IT inventory screen at `/assets/assets` — presets + `InventoryFilterBar` + enhanced register table.

| Work item | Detail |
|-----------|--------|
| `AssetInventoryContainer` | API, filters, branch, pagination |
| `inventory.mapper.ts` | List DTO → row view models |
| `AssetInventoryWorkspace` | Presentational layout |
| API | `GET /assets/assets` + assignment batch for holder columns |

**Status:** Complete. View-only row action.

---

## Phase 3.4B-1 — Inventory interaction layer ✅

**Goal:** `InventoryActionMenu`, `AssetDetailDrawer`, drawer sections (no navigation).

**Status:** Complete.

---

## Phase 3.4B-2 — Inventory workflow integration ✅

**Goal:** `AssetNavigation` + container wiring to existing modules.

**Status:** Complete.

---

## Phase 4.1 — Excel migration architecture (analysis only) ✅

**Goal:** Assignment vs Excel gap analysis; ownership lock; import plan. **No frontend code.**

**Status:** Complete. See `CR-004-Phase-4.1-Excel-Gap-Analysis.md`, `CR-004-Assignment-Workflow.md`.

**Frontend implications (deferred):**

| Item | Target phase |
|------|----------------|
| Challan + remarks on assignment form | Phase 5 |
| Return dialog (`good` / `outdated` / `dead`) | Phase 5 (blocked on API body) |
| Earlier-used-by panel (history) | Phase 5 |
| IT register export | Phase 7 |

---

## Phase 5 — Assignment enrichment

**Goal:** Excel issue/return parity in Assignment workspace.

| Work item | Detail | Status |
|-----------|--------|--------|
| Backend D-010 + return API | Phase 5A-1 / 5A-2 | ✅ |
| UI design freeze | Phase 5B-1 — wizards, wireframes, journeys | ✅ |
| Wizard implementation | Phase 5B-2+ per `CR-004-Phase-5B1-Assignment-UI-Design.md` | Planned |
| Form fields | `delivery_reference_*`, `assignment_remarks` | Designed |
| Return UX | Condition selector → ops bucket alignment | Designed |
| Inventory drawer | Return link + enrichment display | Designed |

**Prerequisite:** Backend D-010 columns + return request schema — **met**.

---

## Phase 3.5 — Sidebar

**Goal:** Align shell nav with locked IA.

| Work item | Detail |
|-----------|--------|
| Update `assetManagementNav` labels | Assignment naming |
| Active / expand states | Match routes |
| RBAC filter | Hide unauthorized items |
| Remove / demote | Old horizontal tab dashboard links if redundant |

**No new routes** except inventory aliases (defer to 3.4).

---

## Phase 3.6 — Inventory views

**Goal:** Filtered register pages + column set.

| Work item | Detail |
|-----------|--------|
| Presets + filter bar | Done in 3.4A at `/assets/assets` |
| KPI deep links | From 3.3 dashboard → preset query (future) |

**Gap handling:** RO derived columns show placeholder until portal/composer available.

---

## Phase 3.6 — Quick actions + polish

**Goal:** Speed up daily IT flows from dashboard and list toolbar.

| Work item | Detail |
|-----------|--------|
| Register | Deep link + wizard entry |
| Assign | Pre-filter READY assets in assignment create |
| Return | Return dialog with **good / outdated / dead** (`return_condition`) when API exposed |
| Discovery | Asset picker → discovery section |
| View Portal | Link to information portal route |
| QR | Link to qr-barcode workspace |
| Motion / a11y | 150–300ms transitions, focus rings, reduced motion |

---

## Cross-cutting (all phases)

- Follow `ui-ux-pro-max` + `MASTER.md` tokens.
- Persist page override: `design-system/.../pages/assets-dashboard.md` when 3.2 starts.
- E2E smoke: dashboard load, filter navigation, list pagination.

---

## Suggested timeline

| Phase | Relative effort |
|-------|-----------------|
| 3.2 Shared UI | M (done) |
| 3.3A Layout | S (done) |
| 3.3B Dashboard data | M (done) |
| 3.4A Inventory foundation | L (done) |
| 3.4B Inventory operations | M |
| 3.5 Sidebar | S |
| 3.6 Quick actions | M |

---

## Definition of done (CR-004 IT Admin UI)

- IT Admin lands on operational dashboard with live ops KPIs.
- Sidebar matches locked structure.
- Six inventory views work via single register API filter.
- No direct edit of `operational_status` in UI (workflows only).
- CR-001/002/003 screens still reachable from sidebar.
