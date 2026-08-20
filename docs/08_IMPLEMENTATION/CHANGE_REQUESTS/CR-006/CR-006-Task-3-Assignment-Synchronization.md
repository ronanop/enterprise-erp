# CR-006 — Task 3 — Assignment Success → Asset Register Synchronization

**Status:** Complete  
**Date:** 2026-08-06  
**Scope:** After a successful Asset Allocation, synchronize the Asset Register and Asset Drawer through existing client refresh bridges — no backend changes, no browser reload, no new APIs.

---

## Objective

```text
AssignmentWizardContainer submit/activate
  → onSuccess({ assignmentId, assetId, employeeLabel })
  → stashInventoryArrival(reason: "issue", toast)
  → markInventoryStale(reason: "issue")
  → AssignmentNavigation.openInventory(assetId)
  → AssetInventoryContainer soft reload
  → toast + highlight + drawer reopen with refreshed row
```

No backend changes. No schema changes. No duplicate APIs.

---

## Implemented

| Item | Behavior |
|------|----------|
| Success navigation | Issue page host reuses `AssignmentNavigation.openInventory(assetId)` |
| Soft register refresh | Existing stale bridge (`reason: "issue"`) triggers inventory remount reload |
| Success toast | Arrival payload shows `Asset successfully allocated to {employee}.` |
| Row highlight | Focus asset handoff highlights the updated register row once |
| Visibility after allocate | Issue arrival resets register UI to page 1 / all-assets so ASSIGNED row remains visible |
| Drawer refresh | After issue arrival, drawer reopens for the focused asset using freshly mapped row data |
| Live drawer sync | If a drawer is open for an asset already in the list, row remaps update holder/history/timeline |
| Action bar state | Ready To Move → `Allocate Asset`; Assigned → `Return Asset` |
| Failure path | Wizard remains on page with existing action/validation errors; no redirect |

---

## Register Updates

After allocation success, the register soft-reloads assignment + asset lists and remaps:

- Operational Status → `ASSIGNED`
- Current Holder / Employee display
- Assignment / Issue Date
- Branch (existing mapper)
- Highlighted allocated row

---

## Drawer Updates

When the drawer is reopened/synced for the allocated asset:

- Current Holder
- Assignment Information
- Assignment History (Assigned To / Employee / Issue Date / Delivery Status)
- Timeline (Assigned event from history mapper)
- Bottom action bar switches Allocate → Return

---

## Components Reused

| Artifact | Reuse |
|----------|-------|
| `AssignmentWizardContainer` | Existing submit/activate; richer `onSuccess` context |
| `AssignmentFrontendService` | Existing create/submit/approve path |
| `AssignmentNavigation` / `AssetNavigation` | Existing inventory return + focus stash |
| `AssetInventoryContainer` | Existing reloadToken / stale consume / arrival consume |
| `AssetInventoryWorkspace` | Existing toast + highlight presentation |
| `AssetDetailDrawer` + history/timeline sections | Existing drawer mapping from inventory rows |
| `inventory-refresh.ts` | Existing stale soft-refresh bridge |
| `inventory-arrival.ts` | Extended for `issue` arrival toast/focus |

---

## Tests

Focused coverage added/updated for:

- Allocation success payload (`assetId`, employee label)
- Failure stays on wizard (no success callback)
- Issue arrival toast + highlight
- Drawer reopen after issue arrival
- Assigned action bar (`Return Asset`)
- Ready action bar (`Allocate Asset`)
- Assignment success sync helper (stale + arrival + focus navigation)
- Existing register/drawer regressions

Validated suites:

```bash
cd apps/web
npx vitest run src/components/assets/assignment-wizard/assignment-wizard-container.test.tsx src/components/assets/inventory/inventory-arrival.test.ts src/components/assets/inventory/assignment-success-sync.test.ts src/components/assets/asset-inventory-container.test.tsx src/components/assets/inventory/interaction/inventory-interaction.test.tsx src/components/assets/inventory/inventory-workflow-callbacks.test.tsx src/components/assets/inventory/inventory-integration.test.tsx
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Allocated asset hidden by Ready To Move preset | Issue arrival resets UI snapshot to all-assets page 1 |
| Employee label missing in toast | Falls back to `Asset successfully allocated.` |
| Drawer reopen races loading | Reopen waits until rows finish loading and focused asset is present |
