# CR-004 — Phase 5B-2B — Assignment Workflow Integration

**Status:** Complete  
**Date:** 2026-08-04  
**Scope:** Frontend only — wire Issue/Return wizards to existing `/assets/asset-assignments` REST API.

---

## Objective

Integrate the Phase 5B-2A wizards with the Phase 5A assignment API without new backend endpoints. Enforce:

```text
Wizard (presentational)
  → Container (load/save/submit/return)
    → AssignmentFrontendService
      → resourceService / assetOperationsService
```

No `fetch` or `resourceService` calls inside wizard step components.

---

## Deliverables

| Artifact | Role |
|----------|------|
| `assignment-frontend-service.ts` | Draft create/update, submit, approve (best-effort activate), return, ready assets, components, active assignment lookup |
| `assignment-wizard-mapper.ts` | API ↔ wizard state, remarks `[Issued: …]` encoding, return body/summary |
| `assignment-wizard-query.ts` | Query parsing + href builders for inventory deep links |
| `assignment-wizard-container.tsx` | Issue wizard: lookups, draft load, prefill, save, optional submit+activate |
| `return-wizard-container.tsx` | Return wizard: resolve active assignment, POST return |
| `wizard-load-error-banner.tsx` | Load/action errors with Retry |
| Routes `/assets/asset-assignments/new`, `/return` | Pages host containers + `useSearchParams` |
| `asset-navigation.ts` | Inventory assign/return → wizard URLs |
| `asset-assignment-workspace.tsx` | Legacy `?assetId` / `intent=return` → wizard redirect; **Add assignment** → `/new` |

---

## Query parameters

| Param | Issue wizard | Return wizard |
|-------|--------------|---------------|
| `assetId` | Prefill asset + load components | Resolve active assignment |
| `draftId` | Load draft (draft status only) | — |
| `employeeId` | Prefill employee step | — |
| `submit=true` | After save on finish, submit + try approve | — |
| `intent=return` | — | Semantic (inventory links) |
| `assignmentId` | — | Direct assignment load |

Aliases: `asset_id`, `draft_id`, `employee_id`, `assignment_id`.

---

## Workflow behavior

1. **Save draft** — `POST` or `PATCH` assignment with enrichment fields; updates local `draftId` / `version`; stays on wizard.
2. **Finish (issue)** — Same persist; if `submit` query set, calls `submit` then `approve` (approve errors ignored when workflow needs more steps).
3. **Return** — `POST …/{id}/return` with `return_condition`, `return_remarks`, `reason`.
4. **Inventory** — `buildIssueWizardHref` / `buildReturnWizardHref` used from `assetNavigationPaths`.

---

## Testing

Vitest (jsdom) under `apps/web`:

| Suite | Focus |
|-------|--------|
| `assignment-wizard.test.tsx` | UI steps, validation, footer |
| `assignment-wizard-mapper.test.ts` | Remarks, bodies, summary |
| `assignment-wizard-query.test.ts` | Parse + href builders |
| `assignment-frontend-service.test.ts` | Draft save, submit/activate, errors |
| `assignment-wizard-container.test.tsx` | Load, draft, retry, save |
| `return-wizard-container.test.tsx` | Load, return submit, errors |
| `asset-navigation.test.ts` | Wizard paths |
| `asset-inventory-navigation.test.tsx` | Assign menu → `/new` |

**Target:** 50+ tests for this phase — **met** (90+ in assignment integration suites).

---

## Risks

| Risk | Mitigation |
|------|------------|
| Auto-approve may not activate in multi-step workflow | Documented; approve failure swallowed after submit |
| Draft remarks ↔ issued components matched by label | Prefer component IDs on new drafts |
| Workspace still supports legacy modal for roster shortcuts | Wizard is primary path for new/issue/return deep links |
| `useSearchParams` on wizard pages | App layout Suspense (existing pattern) |

---

## Validation

```bash
cd apps/web
npm run test -- src/components/assets/assignment-wizard src/services/assignment-frontend-service.test.ts
npm run typecheck
```

Manual: Inventory → Assign → issue wizard with asset prefill; Return → return wizard; save draft; list workspace refresh.

---

## Out of scope (5B-2B)

Backend changes, sidebar, dashboard, reports, Excel import.
