# CR-006 — Task 2 — Asset Drawer → Assignment Wizard Integration

**Status:** Complete  
**Date:** 2026-08-06  
**Scope:** Reuse the existing Asset Register drawer, assignment navigation, assignment container, and inventory refresh flow so drawer-based allocation opens the Assignment Wizard with a prefilled read-only asset and returns to the register without a browser reload.

---

## Objective

```text
Asset Register row
  → AssetDetailDrawer
  → Allocate Asset
  → AssignmentNavigation / AssetNavigation assetId deep link
  → AssignmentWizardContainer preload existing asset
  → read-only Asset Information step
  → Employee → Issued Items → Assignment Details → Review
  → submit / activate through existing frontend service
  → inventory stale bridge
  → Asset Register refresh + drawer closes on return
```

No backend changes. No new APIs. No duplicate pages.

---

## Implemented

| Item | Behavior |
|------|----------|
| Drawer launch | Drawer action bar now exposes `Allocate Asset`, reusing the existing `assign` action path |
| Asset prefill | Wizard continues using `assetId` query/navigation helpers; no new params were added |
| Read-only asset step | When launched with `assetId`, the first step is `Asset Information` and the asset picker is hidden |
| Locked asset details | The wizard displays Asset Tag, Asset Name, Serial Number, Make, Model, Configuration, Branch, and Current Status as read-only |
| Duplicate selection removed | Prefilled launches do not show the Ready To Move asset chooser or require a second selection |
| Invalid asset handling | Missing / invalid `assetId` now falls back to the existing wizard load error banner instead of crashing |
| Already-assigned guard | Prefilled assets that are not `READY_TO_MOVE` surface an existing load-state error and do not continue |
| Success return | Submit/activate still reuses the existing success callback + stale refresh route back to `Asset Register` |

---

## Components Reused

| Artifact | Reuse |
|----------|-------|
| `AssetDetailDrawer` | Existing drawer presentation and action wiring |
| `DrawerActionBar` | Existing bottom action bar, updated label only |
| `AssetNavigation` | Existing asset-route SSOT for opening assignment from inventory |
| `AssignmentNavigation` | Existing canonical deep-link builder using `assetId` |
| `AssignmentWizardContainer` | Existing load/save/submit orchestration, extended to hydrate prefilled assets |
| `AssignmentWizard` | Existing multi-step wizard, now supports prefilled step ordering |
| `AssetStep` | Existing asset UI reused in read-only mode for drawer launches |
| `AssignmentFrontendService` | Existing list/create/update/submit/approve/get-asset calls |
| `inventory-refresh.ts` | Existing stale-session bridge for register refresh after successful assignment |

---

## Tests

Focused coverage added/updated for:

- Drawer `Allocate Asset` action
- Inventory menu → wizard deep link regression
- Prefilled asset step ordering
- Read-only asset details with hidden selector
- Prefilled asset hydrate from `getAsset`
- Invalid `assetId` error state
- Already-assigned / not-ready asset error state
- Existing assignment submit + register refresh regressions

Validated suites:

```bash
cd apps/web
npx vitest run src/components/assets/assignment-wizard/assignment-wizard.test.tsx src/components/assets/assignment-wizard/assignment-wizard-container.test.tsx src/components/assets/assignment-wizard/assignment-wizard-query-integration.test.tsx src/components/assets/inventory/inventory-integration.test.tsx src/components/assets/inventory/interaction/inventory-interaction.test.tsx src/components/assets/navigation/asset-navigation.test.ts src/components/assets/navigation/assignment-navigation.test.ts src/components/assets/inventory/inventory-workflow-callbacks.test.tsx
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Prefilled asset may not be present in the ready-assets list | Container now hydrates the asset through the existing `getAsset()` call and appends a local read-only option |
| Backend status labels may vary by environment | Guard is based on existing `operational_status`; non-`READY_TO_MOVE` assets are blocked early |
| Drawer button label changed for MVP clarity | Only the drawer CTA text changed; the underlying `assign` action id and navigation remain unchanged |
