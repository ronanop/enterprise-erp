# CR-004 — Phase 5B-2B Task 1 — Assignment Frontend Service

**Status:** Complete  
**Date:** 2026-08-05  
**Scope:** Pure frontend API wrapper for existing Assignment REST endpoints. No UI.

---

## Objective

Establish `assignmentFrontendService` as the **single source of truth** for Assignment API communication:

```text
UI / Containers (later)
  → AssignmentFrontendService
    → resourceService (api-client)
      → Existing /assets/asset-assignments APIs
```

Rules enforced:

- No `fetch()` in UI
- No router / React hooks / state in this layer
- Typed promises + consistent `AssignmentError` mapping
- Reuse `resourceService` auth/token handling

---

## Types

| Type | Maps to backend | Purpose |
|------|-----------------|---------|
| `AssignmentDraft` | `AssetAssignmentCreate` / `Update` | Create/update payload |
| `AssignmentResponse` | `AssetAssignmentResponse` | Assignment row |
| `AssignmentReturnRequest` | `AssetAssignmentReturnRequest` | Return action body |
| `AssignmentError` | — | Normalized failure (`status`, `errors`) |

---

## API methods

| Method | HTTP | Path |
|--------|------|------|
| `createDraft(body)` | POST | `/assets/asset-assignments` |
| `loadAssignment(id)` | GET | `/assets/asset-assignments/{id}` |
| `loadDraft(id)` | GET | same + asserts `status === "draft"` |
| `updateDraft(id, body)` | PATCH | `/assets/asset-assignments/{id}` |
| `submitDraft(id)` | POST | `…/{id}/submit` |
| `activateAssignment(id, comments?)` | POST | `…/{id}/approve` |
| `returnAsset(id, body)` | POST | `…/{id}/return` |

Errors from `ApiClientError` / network failures are rethrown as `AssignmentError` via `toAssignmentError`.

---

## Out of scope (Task 1)

Wizard integration, containers, routing, inventory, React hooks, loading UI, backend changes.

---

## Tests

`apps/web/src/services/assignment-frontend-service.test.ts` — **20+** cases:

- Success paths for all seven methods
- API failures (400/403/404/409/422)
- Network failures (`status: 0`)
- Payload mapping (enrichment + return body)
- `loadDraft` non-draft rejection
- Compatibility aliases / `formatError`

```bash
cd apps/web
npm run test -- src/services/assignment-frontend-service.test.ts
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| `activateAssignment` may not fully activate multi-step workflow | Callers treat approve as best-effort |
| `loadDraft` client-side status check only | Backend remains source of write rules |
| DTO drift vs OpenAPI | Types mirror Phase 5A schemas; regenerate when API changes |
