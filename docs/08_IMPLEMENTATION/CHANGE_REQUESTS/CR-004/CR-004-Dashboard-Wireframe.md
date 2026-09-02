# CR-004 — Dashboard Wireframe (IT Admin Landing)

**Route:** `/assets` (exact)  
**Replaces:** Generic ERP workspace card grid as primary content (cards may move to “More” or footer links in 3.2).

---

## ASCII wireframe — Desktop (≥1280px)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                        │
│ Good morning, {displayName}          Branch: {branchName} ▾    [User menu]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ BRANCH FILTER  (segmented control)                                            │
│ [ All ] [ Noida ] [ Mumbai ] [ Dubai ]     ← tenant branches + “All”        │
├──────────────────────────────────────────────────────────────────────────────┤
│ KPI CARDS (6-up, equal width, clickable → filtered inventory view)            │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│ │ Total  │ │ Ready  │ │Assigned│ │ Retired│ │ Pending│ │Disposed│          │
│ │  248   │ │   42   │ │  180   │ │   12   │ │    8   │ │    6   │          │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘          │
├──────────────────────────────────────────────────────────────────────────────┤
│ QUICK ACTIONS (primary buttons, icon + label)                                 │
│ [ Register Asset ] [ Assign Asset ] [ Return Asset ] [ Discovery ]              │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ OPERATIONAL QUEUES (left 50%) │ RECENT ACTIVITY (right 50%)                   │
│ Ready To Move Queue           │ Recent Assignments (table, 5 rows)            │
│ ┌─────┬──────────┬──────────┐ │ Recent Returns (table, 5 rows)              │
│ │ Tag │ Name     │ Branch   │ │ Recent Registrations (table, 5 rows)        │
│ │ ... │ ...      │ ...      │ │ [ View all → ] per section                    │
│ └─────┴──────────┴──────────┘ │                                              │
│ [ View all READY → ]          │                                              │
│                               │                                              │
│ Pending Disposal Queue        │                                              │
│ ┌─────┬──────────┬──────────┐ │                                              │
│ │ ... │ ...      │ ...      │ │                                              │
│ └─────┴──────────┴──────────┘ │                                              │
│ [ View all PENDING → ]        │                                              │
└───────────────────────────────┴──────────────────────────────────────────────┘
```

---

## Header

| Element | Source | Behavior |
|---------|--------|----------|
| Greeting | Time-based copy: “Good morning” / “Good afternoon” / “Good evening” | Static i18n-ready string + name |
| Current branch | Session `branch_id` → org branch label | Read-only; branch filter can override dashboard scope |
| Current user | Auth profile `display_name` | Read-only |

---

## KPI cards

| Card | Click target | API field |
|------|--------------|-----------|
| Total Assets | `/assets/assets` (no ops filter) | `total_assets` |
| Ready To Move | `/assets/inventory/ready-to-move` (see inventory doc) | `ready_to_move` |
| Assigned | `.../assigned` | `assigned` |
| Retired | `.../retired` | `retired` |
| Pending Disposal | `.../pending-disposal` | `pending_disposal` |
| Disposed | `.../disposed` | `disposed` |

**Visual:** Swiss minimal cards — border `#E2E8F0`, number `Fira Code` semibold, label `Fira Sans` 12px muted. Hover: subtle shadow + `cursor-pointer`. Active filter: accent left border `#0369A1`.

**Loading:** Skeleton 6 cards. **Error:** Inline alert + retry on `dashboard-summary`.

---

## Branch filter

| Option | Behavior |
|--------|----------|
| **All** | `GET dashboard-summary` without `branch_id`; show `by_branch` optional tooltip breakdown |
| **Noida / Mumbai / Dubai** | Example branch names from org master — not hardcoded in prod; design shows 3+1 pattern |

Changing branch refetches summary + both queues + recent activity lists with `branch_id` query param.

---

## Quick actions

| Action | Navigation | Permission |
|--------|------------|------------|
| Register Asset | `/assets/assets/new` | `asset.asset:create` |
| Assign Asset | `/assets/asset-assignments` → create | `asset.assignment:create` |
| Return Asset | `/assets/asset-assignments` (filter active) | `asset.assignment:return` |
| Discovery | Modal: enter asset id/tag or pick from READY queue → discovery panel route | `asset.asset:read` + discovery apply perms |

---

## Operational queues

| Queue | API | Columns (minimal) |
|-------|-----|-------------------|
| Ready To Move | `GET /assets/assets?operational_status=READY_TO_MOVE&limit=8` | Asset Tag, Laptop Name, Branch |
| Pending Disposal | `...PENDING_DISPOSAL` | Asset Tag, Laptop Name, Branch, Lifecycle status |

Row click → asset detail workspace.

---

## Recent activity

| Section | API | Columns |
|---------|-----|---------|
| Recent Assignments | `GET /asset-assignments?status=active&limit=5` | Doc #, Asset tag, Employee, Date |
| Recent Returns | `status=returned&limit=5` | Doc #, Asset tag, Returned at |
| Recent Registrations | `GET /assets/assets?limit=5` (client sort `created_at` desc) | Asset code, Name, Created |

**Gap:** No unified activity feed API — compose three calls (documented; no backend in 3.1).

---

## Responsive behavior

### Desktop (≥1280px)

- KPI 6-column grid.
- Queues | Activity 50/50 split.
- Sidebar visible (app shell).

### Tablet (768–1279px)

- KPI 3×2 grid.
- Quick actions horizontal scroll if needed.
- Queues stacked above Recent Activity (full width).

### Mobile (&lt;768px)

- Greeting + branch on one row; branch → bottom sheet picker.
- KPI 2×3 grid (smaller typography).
- Quick actions 2×2 grid.
- Queues as accordion (Ready expanded by default).
- Recent Activity tabs: Assignments | Returns | Registrations.

---

## States

| State | UX |
|-------|-----|
| Empty tenant | KPI zeros; queues show empty state CTA “Register first asset” |
| No permission | Hide quick actions; KPI read-only if `asset.asset:read` |
| Stale data | Optional “Updated {time}” + manual refresh icon |

---

## Out of scope (3.1)

Charts, executive report widgets, lifecycle funnel strip (depreciation pipeline) — not on IT Admin landing.
