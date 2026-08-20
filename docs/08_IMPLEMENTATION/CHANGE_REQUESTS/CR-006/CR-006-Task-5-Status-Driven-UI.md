# CR-006 — Task 5 — Status Driven UI & Business Actions

**Status:** Complete  
**Date:** 2026-08-06  
**Scope:** Make Asset Register and Asset Detail Drawer status-aware using Operational Status. Hide invalid actions. No backend changes, no new APIs, no duplicate pages.

---

## Objective

```text
Operational Status
  → STATUS_ACTION_MATRIX
  → InventoryActionMenu (register)
  → DrawerActionBar (drawer)
  → dispatchInventoryMenuAction / handleInventoryMenuWorkflow (nav guards)
```

Backend validation remains the second layer.

---

## Status Matrix

| Status | Allowed | Hidden |
|--------|---------|--------|
| READY_TO_MOVE | View, Edit, Allocate Asset, Delete, View History | Return Asset, Disposal |
| ASSIGNED | View, Return Asset, View History | Edit, Delete, Allocate Asset |
| RETIRED | View, View History | Allocate, Return, Edit, Delete |
| PENDING_DISPOSAL | View, Complete Disposal, View History | Allocate, Return, Edit, Delete |
| DISPOSED | View, View History | Allocate, Return, Edit, Delete, Disposal |

---

## Register Actions

`InventoryActionMenu` filters `INVENTORY_MENU_ITEMS` by RBAC + `isStatusActionAllowed`.

- View remains an inline button when permitted.
- Overflow menu only lists status-valid business actions.
- Empty permissions/status → informational “No actions available” text.

---

## Drawer Actions

`DrawerActionBar` shows a single primary CTA via `resolveDrawerPrimaryAction`:

| Status | CTA |
|--------|-----|
| READY_TO_MOVE | Allocate Asset |
| ASSIGNED | Return Asset |
| RETIRED | View History |
| PENDING_DISPOSAL | Complete Disposal |
| DISPOSED | View History |

When the primary action is unavailable (unknown status or permission denied), the bar shows an informational empty-state message instead of empty buttons.

---

## Status Badges

Reused `StatusBadge` (`kind="operational"`). Color alignment:

| Status | Color |
|--------|-------|
| READY_TO_MOVE | Green (emerald) |
| ASSIGNED | Blue |
| RETIRED | Orange |
| PENDING_DISPOSAL | Amber |
| DISPOSED | Gray (muted) |

No new status values introduced.

---

## Navigation Guards

`dispatchInventoryMenuAction` and `handleInventoryMenuWorkflow` reject status-invalid workflows before routing (example: Assigned → Allocate never navigates).

Edit → asset detail `?intent=edit`  
Delete → same detail surface (soft-delete UX placeholder)  
Dispose → `/assets/asset-disposals?assetId=…`  
History → asset detail `?tab=activity`

---

## Components Reused

| Artifact | Role |
|----------|------|
| `AssetInventoryWorkspace` / `AssetInventoryContainer` | Register + drawer host |
| `AssetDetailDrawer` / `DrawerActionBar` | Status-driven primary CTA |
| `InventoryActionMenu` | Status-filtered register actions |
| `status-driven-actions.ts` | Matrix SSOT |
| `asset-navigation` / `inventory-workflow` | Gated navigation |
| `StatusBadge` | Existing operational badges |

---

## Tests

Primary suite: `status-driven-actions.test.tsx` (50+ cases) covering matrix, drawer CTAs, register menus, nav guards, badge colors, and regression with existing inventory interaction/integration suites.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Delete has no dedicated UI | Routes to detail with `intent=edit`; backend enforces soft-delete rules |
| Disposal completion UX is list deep-link | Reuses existing disposal route + `assetId` query |
| Unknown operational status | Mutating actions denied; view/history only |
| Portal/Transfer removed from bottom bar | Status matrix owns business CTAs; documents tab retains QR entry |

---

## Validation

- [x] No backend / schema / API changes
- [x] No duplicate register/drawer pages
- [x] Invalid Allocate/Return/Edit/Delete/Dispose hidden by status
- [x] Drawer CTA matches status matrix
- [x] Navigation blocked for invalid workflows
- [x] Badge colors aligned; existing labels reused
