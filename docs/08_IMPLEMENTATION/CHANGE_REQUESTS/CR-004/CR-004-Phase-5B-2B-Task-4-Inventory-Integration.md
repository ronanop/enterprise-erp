# CR-004 — Phase 5B-2B Task 4 — Inventory Integration

**Status:** Complete  
**Date:** 2026-08-05  
**Scope:** Wire Inventory Assign/Return to existing wizard containers via AssetNavigation. Soft refresh after success. No backend.

---

## Objective

```text
Inventory Workspace
  → AssetNavigation (existing hrefs)
    → Issue / Return page hosts
      → AssignmentWizardContainer / ReturnWizardContainer
        → AssignmentFrontendService
          → Backend
```

Inventory owns selection, drawer, and navigation.  
Assignment owns issue workflow.  
Return owns return workflow.  
Operational status remains backend-driven (list reload picks up new values).

---

## Implemented

| Item | Behavior |
|------|----------|
| Inventory Assign | Menu → close drawer → `/assets/asset-assignments/new?assetId=` (existing navigation) |
| Inventory Return | Menu → close drawer → `/assets/asset-assignments/return?assetId=&intent=return` |
| Asset prefill | Page host maps `assetId` → container `initialState` / `assetId` props |
| Issue success | `markInventoryStale({ reason: "issue" })` → soft `router.push("/assets/assets")` |
| Return success | `markInventoryStale({ reason: "return" })` → soft return to inventory |
| Inventory refresh | `consumeInventoryStale()` bumps `reloadToken` → re-fetch list (no full page reload) |
| Drawer | Closed before workflow nav; closed again on stale refresh |
| Selected row / ops status | Updated via list reload from backend after return/issue |

### Dashboard KPI refresh — **Deferred**

No shared dashboard cache/store exists (`AssetOperationsContainer` loads on its own mount). KPI refresh after Issue/Return is deferred until a cache/event bus is introduced.

### Query note

Containers remain query-agnostic (Tasks 2–3). Existing navigation hrefs already carry `assetId`; **page hosts** map them to props. No new query-parameter module; no navigation refactor.

---

## Files

| Artifact | Role |
|----------|------|
| `inventory/inventory-refresh.ts` | Soft-refresh session flag |
| `inventory/inventory-workflow.ts` | Drawer close + menu workflow helper |
| `asset-inventory-container.tsx` | Close drawer on Assign/Return; consume stale flag |
| `asset-assignments/new/page.tsx` | Prefill + stale mark + inventory return |
| `asset-assignments/return/page.tsx` | assetId/assignmentId props + stale mark |

---

## Tests (35+)

| Suite | Focus |
|-------|--------|
| `inventory-refresh.test.ts` | Mark / consume / clear / corrupt |
| `inventory-workflow.test.ts` | Assign/Return close + navigate; prefill helpers |
| `inventory-integration.test.tsx` | Inventory → Issue/Return, drawer, refresh, retry |
| `inventory-workflow-callbacks.test.tsx` | Container success/failure + stale marking |
| Existing navigation / inventory nav tests | Href contract |

```bash
cd apps/web
npm run test -- src/components/assets/inventory src/components/assets/asset-inventory-navigation.test.tsx src/components/assets/navigation/asset-navigation.test.ts
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Soft nav may restore cached RSC payload | Stale flag forces client reloadToken bump |
| sessionStorage unavailable | Mark/consume no-ops; remount still loads once |
| Dashboard KPIs stale until revisit | Documented deferred |
| Return page without assetId shows error | Inventory always passes assetId via navigation |
