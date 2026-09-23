# CR-004 Phase 3.3A — Asset Operations Layout

**Status:** Complete (layout only)  
**Date:** 2026-08-03  
**Component:** `apps/web/src/components/assets/asset-operations-dashboard.tsx`

---

## Scope

Visual layout for the IT Asset Operations landing workspace. **No** API calls, React Query, routing changes, or business logic.

Composes Phase 3.2 shared components only for KPIs, queues, branch filter, and quick actions.

---

## Layout structure

| Region | Content |
|--------|---------|
| Header | Title, subtitle, BranchSelector, notification + profile placeholders |
| Row 1 | Six StatCards (default: loading skeletons) |
| Row 2 | Six QuickActionCards |
| Row 3 | Ready queue, Pending disposal queue, Recent activity (QueueCard × 3) |

---

## Responsive behavior

| Breakpoint | KPI grid | Quick actions | Operations |
|------------|----------|---------------|------------|
| Mobile | 1 column | 1 column | stacked |
| Tablet (`md`) | 3 columns (2 rows) | 2 columns | stacked |
| Desktop (`xl` / `lg`) | 6 columns | 6 columns | 3 columns |

---

## Props

| Prop | Default | Purpose |
|------|---------|---------|
| `kpisLoading` | `true` | StatCard skeletons |
| `queuesLoading` | `false` | QueueCard skeletons |
| `showDemoKpiPlaceholders` | `true` | Demo counts when KPIs not loading |
| `branches` | Noida / Mumbai / Dubai | BranchSelector options |

Demo queue rows are static placeholders inside the component (not API data).

---

## Testing

- **File:** `asset-operations-dashboard.test.tsx`
- **Run:** `npm run test` in `apps/web`
- Covers header, branch control, KPI loading/demo/empty, quick actions, queues, responsive class hooks, composition.

---

## Next

**Phase 3.3B** — Wire layout to `/assets`, `dashboard-summary` client, and live queue lists (per frontend plan).

---

## Out of scope

API integration, navigation, permissions, sidebar, inventory routes.
