# CR-006 — Task 4 — Return Success → Asset Register Synchronization

**Status:** Complete  
**Date:** 2026-08-06  
**Scope:** After a successful asset return, synchronize the Asset Register and Asset Drawer through existing client refresh bridges — no backend changes, no browser reload, no new APIs.

---

## Objective

```text
ReturnWizardContainer confirm
  → onSuccess({ assignmentId, assetId, assetName, returnCondition })
  → stashInventoryArrival(reason: "return", toast)
  → markInventoryStale(reason: "return")
  → AssignmentNavigation.openInventory(assetId)
  → AssetInventoryContainer soft reload
  → toast + highlight + drawer reopen with refreshed row
```

Operational status after return remains backend-owned:

| Return condition | Backend operational status |
|------------------|----------------------------|
| GOOD | READY_TO_MOVE |
| OUTDATED | RETIRED |
| DEAD | PENDING_DISPOSAL |

No new frontend business rules were added for status transitions.

---

## Implemented

| Item | Behavior |
|------|----------|
| Success navigation | Return page host reuses `AssignmentNavigation.openInventory(assetId)` |
| Soft register refresh | Existing stale bridge (`reason: "return"`) triggers inventory remount reload |
| Success toast | Arrival payload shows `{Asset Name} returned successfully.` |
| Row highlight | Focus asset handoff highlights the updated register row once |
| Visibility after return | Return arrival resets register UI to page 1 / all-assets |
| Drawer refresh | After return arrival, drawer reopens for the focused asset using freshly mapped row data |
| Live drawer sync | Open drawers remap holder/history/timeline when rows refresh |
| Action bar state | Assigned → `Return Asset`; Ready To Move → `Allocate Asset`; Retired/Pending Disposal hide both custody CTAs |
| History labels | Returned entries surface Returned By, Return Date, optional Return Condition, Delivery Status, Return Remarks |
| Failure path | Wizard remains on page with existing action/validation errors; no redirect |

---

## Register Updates

After return success, the register soft-reloads assignment + asset lists and remaps:

- Operational Status (backend result: Ready / Retired / Pending Disposal)
- Current Holder cleared when no active assignment
- Issue Date cleared when no active assignment
- Highlighted returned row

---

## Drawer Updates

When the drawer is reopened/synced for the returned asset:

- Current Holder
- Assignment Information
- Assignment History
- Timeline (Returned event from history mapper)
- Bottom action bar switches Return → Allocate when Ready To Move

---

## Components Reused

| Artifact | Reuse |
|----------|-------|
| `ReturnWizardContainer` | Existing return submit; richer `onSuccess` context |
| `AssignmentFrontendService` | Existing return endpoint |
| `AssignmentNavigation` / `AssetNavigation` | Existing inventory return + focus stash |
| `AssetInventoryContainer` | Existing reloadToken / stale consume / arrival consume |
| `AssetInventoryWorkspace` | Existing toast + highlight presentation |
| `AssetDetailDrawer` + history/timeline sections | Existing drawer mapping from inventory rows |
| `inventory-refresh.ts` | Existing stale soft-refresh bridge |
| `inventory-arrival.ts` | Extended for `return` arrival toast/focus |

---

## Tests

Focused coverage added/updated for:

- Return success payload (`assetId`, asset name, return condition)
- Failure stays on wizard (no success callback)
- Return arrival toast + highlight + drawer reopen
- Allocate CTA restored for Ready To Move
- Retired / Pending Disposal hide custody CTAs
- Return condition history mapping
- Return success sync helper (stale + arrival + focus navigation)
- Existing return/register regressions

Validated suites:

```bash
cd apps/web
npx vitest run src/components/assets/assignment-wizard/return-wizard-container.test.tsx src/components/assets/inventory/inventory-arrival.test.ts src/components/assets/inventory/return-success-sync.test.ts src/components/assets/asset-inventory-container.test.tsx src/components/assets/inventory/interaction/inventory-interaction.test.tsx src/components/assets/inventory/inventory-workflow-callbacks.test.tsx src/components/assets/inventory/register-parity.test.tsx src/components/assets/inventory/inventory-integration.test.tsx
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Return condition may be absent from list payloads | History shows condition only when present; status still comes from asset operational_status |
| Returned asset hidden by Assigned preset | Return arrival resets UI snapshot to all-assets page 1 |
| Asset name missing in toast | Falls back to `Asset returned successfully.` |
