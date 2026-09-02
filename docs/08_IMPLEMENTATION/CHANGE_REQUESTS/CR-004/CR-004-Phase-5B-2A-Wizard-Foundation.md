# CR-004 Phase 5B-2A — Assignment Wizard Foundation

**Status:** Complete (UI shell only)  
**Date:** 2026-08-03  
**Prerequisite:** Phase 5B-1 design freeze

---

## Scope

| In scope | Out of scope |
|----------|----------------|
| Assignment wizard (5 steps) | API calls, draft load, submit |
| Return wizard (4 steps) | Return POST, inventory wiring |
| Shared stepper, footer, shell, progress | Backend changes |
| Client-side validation placeholders | Real employee/asset/component data |
| Mock demo data | `intent=return` on assignment workspace |

---

## Routes (preview)

| Route | Component |
|-------|-----------|
| `/assets/asset-assignments/new` | `AssignmentWizard` |
| `/assets/asset-assignments/return` | `ReturnWizard` |

Callbacks `onFinish` / `onSaveDraft` are no-ops until Phase 5B-2B.

---

## Component tree

```text
components/assets/assignment-wizard/
  assignment-wizard.tsx
  return-wizard.tsx
  wizard-shell.tsx
  wizard-stepper.tsx
  wizard-footer.tsx
  wizard-types.ts
  wizard-validation.ts
  wizard-mock-data.ts
  steps/
    employee-step.tsx
    asset-step.tsx
    issued-items-step.tsx
    delivery-step.tsx
    assignment-review-step.tsx
    return-summary-step.tsx
    return-condition-step.tsx
    return-remarks-step.tsx
    return-review-step.tsx
  assignment-wizard.test.tsx
  index.ts
```

---

## Tests

`assignment-wizard.test.tsx` — **36** Vitest cases (navigation, validation placeholders, a11y, empty/loading states).

```bash
cd apps/web && npm run test -- --run src/components/assets/assignment-wizard/assignment-wizard.test.tsx
```

---

## Next phase (5B-2B)

Wire `assets-service` / `resourceService` for create, update, return; replace `wizard-mock-data`; hook list **Issue asset** and inventory navigation.
