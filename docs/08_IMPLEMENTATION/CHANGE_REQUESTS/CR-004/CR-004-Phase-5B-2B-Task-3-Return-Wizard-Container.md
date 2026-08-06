# CR-004 — Phase 5B-2B Task 3 — Return Wizard Container

**Status:** Complete  
**Date:** 2026-08-05  
**Scope:** Connect presentational `ReturnWizard` to `AssignmentFrontendService`. No query params, router, inventory, or backend changes.

---

## Objective

```text
ReturnWizard (presentational)
  → ReturnWizardContainer (load + submit orchestration)
    → AssignmentFrontendService
      → Existing Assignment APIs
```

Rules:

- No `fetch()` in UI
- No router / query parsing inside the container
- No inventory logic
- Wizard receives props/callbacks only

---

## Container responsibilities

| Concern | Behavior |
|---------|----------|
| Load assignment | `assignmentId` → `loadAssignment`, or `assetId` → `findActiveAssignmentForAsset` |
| Populate wizard | Builds `ReturnSummaryView` via asset + assignee label |
| Submit return | `returnAsset(id, { return_condition, return_remarks, reason })` |
| Loading | `loading` / `saving` on wizard |
| Retry | Load-error Retry reloads; action-error Retry dismisses |
| Errors | `formatError` → alert banner |
| Success | `onSuccess()` after successful return |

---

## Props

| Prop | Purpose |
|------|---------|
| `assignmentId?` | Direct assignment load (preferred) |
| `assetId?` | Resolve active assignment for asset |
| `initialState?` | Seed condition / remarks / reason |
| `onCancel?` / `onSuccess?` | Parent owns navigation |
| `service?` | Injectable `ReturnWizardContainerService` |
| `listEmployees?` | Assignee label lookup override |

Requires `assignmentId` **or** `assetId`. Only `status === "active"` assignments can be returned.

---

## Workflow

1. **Mount** — validate id props → load assignment → `getAsset` → build summary.
2. **Steps** — Summary → Condition → Remarks → Review (wizard UI only).
3. **Confirm return** — map state → `returnAsset` → `onSuccess()`.

---

## Out of scope (Task 3)

Inventory integration, query parameters, navigation inside container, backend, dashboard.

---

## Tests

`return-wizard-container.test.tsx` — **25+** cases:

- Load by assignmentId / assetId, preference, summary populate
- Auth / missing id / non-active / no active / getAsset failure
- Retry after load failure
- Submit success + payload defaults
- Return condition (good / outdated / dead / initialState)
- Return remarks + reason trimming
- Action errors + dismiss

```bash
cd apps/web
npm run test -- src/components/assets/assignment-wizard/return-wizard-container.test.tsx
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Page host without ids shows required-id error | Task 4+ will pass `assignmentId` / `assetId` from query/inventory |
| Assignee label depends on employee roster | Fallback to truncated employee id |
| Only active assignments returnable | Explicit status check before submit UI |
