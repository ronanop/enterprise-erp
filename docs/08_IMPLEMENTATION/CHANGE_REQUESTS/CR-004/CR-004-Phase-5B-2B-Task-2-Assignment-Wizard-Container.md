# CR-004 — Phase 5B-2B Task 2 — Assignment Wizard Container

**Status:** Complete  
**Date:** 2026-08-05  
**Scope:** Connect presentational `AssignmentWizard` to `AssignmentFrontendService`. No query params, router, inventory, or return wizard.

---

## Objective

```text
AssignmentWizard (presentational)
  → AssignmentWizardContainer (orchestration + state)
    → AssignmentFrontendService
      → Existing Assignment APIs
```

- No `fetch()` in UI
- No router inside the container
- No business rules inside wizard steps
- Wizard receives props/callbacks only

---

## Container responsibilities

| Concern | Behavior |
|---------|----------|
| Own state | Hydrates `AssignmentWizardState`, employees, ready assets, issued items |
| Load draft | `draftId` prop → `service.loadDraft` + components |
| Create draft | Save draft → `service.createDraft` |
| Update draft | Subsequent save → `service.updateDraft` |
| Submit | Finish → persist → `service.submitDraft` |
| Activate | Best-effort `service.activateAssignment` after submit |
| Loading | `loading` / `saving` props on wizard |
| Retry | Load-error banner Retry reloads; action-error Retry dismisses |
| Success | `onSuccess(assignmentId)` after submit (+ activate attempt) |
| Errors | `service.formatError` → alert banner |

---

## Props

| Prop | Purpose |
|------|---------|
| `draftId?` | Load existing draft (parent-provided, not URL) |
| `initialState?` | Seed employee/asset/etc. |
| `onCancel?` / `onSuccess?` | Parent owns navigation |
| `service?` | Injectable `AssignmentWizardContainerService` (tests) |
| `listEmployees?` | Employee option lookup override |

---

## Workflow

1. **Mount** — list employees + ready assets; if `draftId`, `loadDraft` + components.
2. **Save draft** — create or update; keep user on wizard; store `draftId` / `version`.
3. **Submit** — create/update → `submitDraft` → try `activateAssignment` → `onSuccess`.
4. Activate failure after successful submit still calls `onSuccess` (multi-step workflow).

---

## Out of scope (Task 2)

Return wizard, inventory, query parameters, navigation inside container, backend changes.

---

## Tests

`assignment-wizard-container.test.tsx` — **30+** cases:

- Loading / auth / retry / load errors
- Draft create + update
- Submit + activate (+ activate failure soft success)
- Submit/persist errors
- Cancel, finish label, payload mapping, asset change → components

```bash
cd apps/web
npm run test -- src/components/assets/assignment-wizard/assignment-wizard-container.test.tsx
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Activate may not reach `active` | Best-effort; caller still notified |
| `initialState` object identity | Read via ref so load effect does not loop |
| Employee list outside Assignment service | Injected `listEmployees`; assignment ops still service-only |
