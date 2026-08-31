# CR-004 — Phase 4 Task 6 — Navigation & End-to-End Integration

**Status:** Complete  
**Date:** 2026-08-05  
**Scope:** Finalize Assignment navigation ownership and validate end-to-end Issue/Return flows. No new business features.

---

## Navigation architecture

```text
Inventory
  → AssetNavigation (module router)
    → AssignmentNavigation (Assignment href SSOT)
      → Page hosts
        → Wizard containers
          → AssignmentFrontendService
            → Backend
```

| Module | Role |
|--------|------|
| `assignment-navigation.ts` | Single owner for Assignment list/new/return/inventory hrefs + `open*` APIs |
| `asset-navigation.ts` | Cross-module inventory menu; delegates Issue/Return to AssignmentNavigation builders |
| Page hosts | Query → props; success/cancel via `createAssignmentNavigation` |

Duplicate href builders consolidated: `buildAssignmentWizardHref` / `buildReturnWizardHref` live in AssignmentNavigation; query module re-exports for parse helpers.

---

## End-to-end workflow

1. **Assign** — snapshot inventory UI → close drawer → Issue wizard (`?assetId=`)  
2. **Success / Cancel** — mark stale (success) → `openInventory` (soft nav)  
3. **Inventory remount** — restore search/filters/page/branch/preset → single list fetch → drawer closed  
4. **Return** — same pattern with Return wizard  

Operational status updates via backend-driven list reload (no client mutation).

### Dashboard KPI refresh — Deferred

No shared dashboard cache/store. Documented deferred (unchanged from Task 4).

---

## Deep links validated

| URL | Expected |
|-----|----------|
| `/new` | Blank issue wizard |
| `/new?assetId=` | Prefill asset |
| `/new?employeeId=` | Prefill employee |
| `/new?draftId=` | Draft resume |
| `/return?assetId=` | Active assignment lookup |
| `/return?assignmentId=` | Direct assignment load |
| `/return?assetId=&intent=return` | Return flow |

---

## Regression coverage

| Check | Status |
|-------|--------|
| Drawer closes on Assign/Return | Covered |
| Selection cleared on return | Covered (drawer + expanded cleared on stale) |
| Search / filters / pagination / branch preserved | UI snapshot |
| No duplicate navigation | Single `push` |
| No duplicate API requests on remount+stale | Single list fetch |
| Retry / errors / loading | Existing container tests |
| Query param regression | Page-props + deep-link catalog |

---

## Tests (50+)

| Suite | Focus |
|-------|--------|
| `assignment-navigation.test.ts` | Nav API + deep links |
| `assignment-e2e.test.tsx` | Inventory → wizard, refresh, parity |
| `inventory-ui-state.test.ts` | Snapshot preserve |
| Existing inventory / query / container suites | Regression |

```bash
cd apps/web
npm run test -- src/components/assets/navigation src/components/assets/inventory src/components/assets/assignment-wizard/assignment-wizard-page-props.test.ts
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Soft nav remount loses React state | UI snapshot in sessionStorage |
| Stale + remount double fetch | Consume stale without reloadToken bump |
| Dashboard KPIs stale | Deferred — no cache |
| Focus asset stash unused by UI | Stored for future highlight; optional |
