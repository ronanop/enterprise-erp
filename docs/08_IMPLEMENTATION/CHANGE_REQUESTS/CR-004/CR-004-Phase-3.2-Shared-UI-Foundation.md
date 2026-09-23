# CR-004 Phase 3.2 — Shared UI Foundation

**Status:** Complete (components only)  
**Date:** 2026-08-03  
**Location:** `apps/web/src/components/assets/shared/`

---

## Scope

Reusable presentational components for IT Admin Experience (Phase 3.1 freeze). **No** dashboard page, inventory pages, sidebar changes, routing, or API calls.

---

## Components

| Component | File | Purpose |
|-----------|------|---------|
| StatCard | `stat-card.tsx` | KPI tiles (total, ready, assigned, …) |
| QueueCard | `queue-card.tsx` | Queue / recent activity tables |
| StatusBadge | `status-badge.tsx` | Operational + lifecycle labels |
| BranchSelector | `branch-selector.tsx` | Segmented branch filter (controlled) |
| InventoryFilterBar | `inventory-filter-bar.tsx` | Search + filters + reset/apply |
| QuickActionCard | `quick-action-card.tsx` | Action tiles (UI only) |
| EmptyState | `empty-state.tsx` | No assets / results / queue |
| Loading skeletons | `loading-skeleton.tsx` | Stat, queue, table, filter bar |

Barrel export: `index.ts` (includes `FilterBar` alias).

---

## Design alignment

- Uses existing ShadCN `Card`, `Badge`, `Button`, `Input`, `Select`, `Label`.
- Tokens: `border-border`, `bg-card`, `text-muted-foreground`, `primary` accent — matches ERP MASTER.
- Light theme default; operational badge colors include `dark:` variants.
- Interaction: `cursor-pointer`, 200ms transitions, focus rings on controls.

---

## Props summary

See TypeScript exports in each file. All data is **props-in**; parents own state and API (later phases).

---

## Testing

- **Runner:** Vitest + Testing Library (`npm run test` in `apps/web`).
- **File:** `shared-components.test.tsx` (20+ cases including parametrized operational badges).

---

## Next

Phase 3.3 — Dashboard page composition (wire `dashboard-summary` client + shared components).

---

## Out of scope (this phase)

Dashboard layout, sidebar, inventory routes, navigation, business logic.
