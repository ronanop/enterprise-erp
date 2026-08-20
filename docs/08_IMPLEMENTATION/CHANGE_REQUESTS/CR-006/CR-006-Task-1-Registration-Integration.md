# CR-006 — Task 1 — Asset Registration → Asset Register Integration

**Status:** Complete  
**Date:** 2026-08-06  
**Scope:** Connect the existing Add Asset flow to the existing Asset Register so successful registration redirects, refreshes, and highlights the new asset without backend or API changes.

---

## Objective

```text
Add Asset Wizard
  → assetRegisterService.create / update / action (existing)
  → AssetNavigation.openInventory() (existing route SSOT)
  → inventory arrival + stale session bridge
  → AssetInventoryContainer reloadToken refresh
  → Asset Register shows success toast + highlighted row
```

No backend changes. No schema changes. No duplicate pages.

---

## Implemented

| Item | Behavior |
|------|----------|
| Success redirect | Wizard now returns to Asset Register via `AssetNavigation.openInventory(assetId)` |
| Success toast | Register arrival shows `Asset registered successfully.` once |
| Soft refresh | Existing inventory stale mechanism now supports `reason: "register"` and triggers client reload |
| New asset focus | Inventory navigation stashes the new `assetId` so the register can highlight it once |
| Pagination visibility | Registration arrival resets register UI to default page 1 / all-assets view, reusing existing sort order and list API |
| Failure path | Wizard stays on Add Asset and preserves inline error state; no redirect |

---

## Components Reused

| Artifact | Reuse |
|----------|-------|
| `AssetAddWizard` | Existing registration UI and service flow |
| `assetRegisterService` | Existing create / update / action calls |
| `AssetNavigation` | Existing route SSOT for register navigation |
| `AssetInventoryContainer` | Existing register data-loading + `reloadToken` refresh |
| `AssetInventoryWorkspace` | Existing register table/cards, extended with one-time toast/highlight props |
| `inventory-refresh.ts` | Existing session-storage stale bridge, extended for registration |

---

## New Client-Side Bridges

| Artifact | Purpose |
|----------|---------|
| `inventory/inventory-focus.ts` | Shared one-time focused asset handoff for inventory |
| `inventory/inventory-arrival.ts` | Registration arrival payload for one-time toast + reset behavior |

These are frontend-only session helpers. They do not introduce new APIs.

---

## Tests

Focused coverage added/updated for:

- Add Asset success redirect
- Add Asset failure no redirect
- Registration stale flag
- Registration arrival payload
- Inventory success toast
- Inventory highlighted row
- Navigation focus handoff
- Existing inventory refresh regression

Validated suites:

```bash
cd apps/web
npx vitest run src/components/assets/asset-add-wizard.test.tsx src/components/assets/asset-inventory-container.test.tsx src/components/assets/asset-inventory-workspace.test.tsx src/components/assets/navigation/asset-navigation.test.ts src/components/assets/navigation/assignment-navigation.test.ts src/components/assets/inventory/inventory-refresh.test.ts src/components/assets/inventory/inventory-arrival.test.ts
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Register list order is backend-defined | Arrival resets to page 1 and reuses existing default sort/list response |
| Session storage unavailable | Register still navigates and reloads normally; toast/highlight quietly no-op |
| Toast system is local to register arrival | Kept scoped to this integration without new dependencies or browser reloads |
