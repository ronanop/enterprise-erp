# CR-004 — Phase 5B-2B Task 5 — Query Parameters & Draft Resume

**Status:** Complete  
**Date:** 2026-08-05  
**Scope:** Deep links and draft resume via page-host query → container props. No backend. Containers remain URL-agnostic.

---

## Architecture

```text
Page Host
  → parse*WizardQuery / *PropsFromSearchParams
    → Container props (draftId, initialState, assetId, assignmentId)
      → Wizard Container
        → AssignmentFrontendService
```

Containers never read URLs.

---

## Supported query parameters

### Assignment — `/assets/asset-assignments/new`

| Param | Container mapping |
|-------|-------------------|
| `assetId` | `initialState.assetId` (prefill asset) |
| `employeeId` | `initialState.employeeId` (prefill employee) |
| `draftId` | `draftId` → `loadDraft` (resume) |

Aliases: `asset_id`, `employee_id`, `draft_id`. Blank/whitespace → treated as missing.

### Return — `/assets/asset-assignments/return`

| Param | Behavior |
|-------|----------|
| `assignmentId` | Direct `loadAssignment` |
| `assetId` | `findActiveAssignmentForAsset` |
| `intent=return` | Opens return flow (missing intent allowed; other values rejected at page host) |

Aliases: `asset_id`, `assignment_id`.

When both ids present, container prefers `assignmentId`.

---

## Page hosts

| Page | Role |
|------|------|
| `new/page.tsx` | `assignmentPropsFromSearchParams` → `AssignmentWizardContainer` |
| `return/page.tsx` | `returnPropsFromSearchParams` → validate intent/target → `ReturnWizardContainer` |

Helpers live in `assignment-wizard-page-props.ts` (not inside containers).

---

## Out of scope

Inventory changes, navigation refactor, backend, dashboard, reports, sidebar, Excel.

---

## Tests (30+)

| Suite | Focus |
|-------|--------|
| `assignment-wizard-page-props.test.ts` | Normalize, map, missing/invalid, href builders |
| `assignment-wizard-query-integration.test.tsx` | Draft resume + return lookup via mapped props |
| Existing `assignment-wizard-query.test.ts` | Parse/build regression |

```bash
cd apps/web
npm run test -- src/components/assets/assignment-wizard/assignment-wizard-page-props.test.ts src/components/assets/assignment-wizard/assignment-wizard-query-integration.test.tsx src/components/assets/assignment-wizard/assignment-wizard-query.test.ts
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| `draftId` + conflicting `assetId` in URL | Container draft load overwrites seed state |
| Invalid `intent` | Page host blocks before container |
| Empty query on return page | Page host shows required-id banner |
