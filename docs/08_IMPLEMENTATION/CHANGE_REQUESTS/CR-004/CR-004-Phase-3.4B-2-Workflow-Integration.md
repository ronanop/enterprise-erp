# CR-004 Phase 3.4B-2 — Inventory Workflow Integration

**Status:** Complete  
**Date:** 2026-08-03  

---

## Architecture

```text
AssetInventoryWorkspace (presentational)
        ↑ callbacks
AssetInventoryContainer
        ↓
AssetNavigation (createAssetNavigation / useAssetNavigation)
        ↓
Existing Next.js routes / modules
```

Interaction components emit `(action, asset)` only — **no routing inside UI**.

---

## Wiring

| User action | Container behavior |
|-------------|-------------------|
| View (row) | Open `AssetDetailDrawer` with mapped row data |
| Menu → View Details | `navigation.openDetails(id)` |
| Menu → Assign / Return / … | `dispatchInventoryMenuAction` |
| Drawer quick links | `dispatchInventoryQuickLink` |

---

## Permissions

`buildInventoryActionPermissions` / `buildInventoryQuickLinkPermissions` from `useUserPermissions().can`.

---

## Out of scope

New backends, duplicate pages, sidebar, reports.

---

## Tests

`asset-navigation.test.ts`, `inventory-permissions.test.ts`, updated interaction + workspace + container tests.
