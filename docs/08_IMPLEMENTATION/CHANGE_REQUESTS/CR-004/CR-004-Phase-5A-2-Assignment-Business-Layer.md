# CR-004 Phase 5A-2 — Assignment Business Layer

**Scope:** Business logic for assignment enrichment (D-010) and return condition API. No UI, import, inventory, or reports.

**Depends on:** Phase 5A-1 (`delivery_reference_*`, `assignment_remarks`, `return_remarks` columns).

---

## Architecture

```text
Router → AssignmentValidator → AssignmentService → AssetAssignmentRepository → ORM
```

`AssignmentService` is the sole business owner for persistence and audit.

---

## Domain (`assignment_enrichment.py`)

| Rule | Behavior |
|------|----------|
| `delivery_reference_status` | Must be `not_applicable`, `pending`, `issued`, or `received`; default `not_applicable` |
| `delivery_reference_number` | Max 100 chars; required when status is `issued` or `received`; forbidden when `not_applicable` |
| `assignment_remarks` | Optional; trim; max 4000; no control characters |
| `return_remarks` | Only on **return**; same length/charset rules |
| Employee issue | On **submit** and **activate**, `allocation_type=employee` requires delivery status ≠ `not_applicable` |

Return condition mapping remains in `assignment_return_condition.py` (`good` / `outdated` / `dead`).

---

## Service

| Operation | Enrichment behavior |
|-----------|---------------------|
| `create` | Validates and persists enrichment fields; audit `new_value` includes non-null enrichment |
| `update` (draft) | Merged enrichment validation; audit includes changed enrichment keys |
| `submit` / `activate` | Row-level enrichment + employee delivery rule |
| `return_assignment` | `validate_return_request`; persists `return_remarks` via `complete_return`; audit includes `return_condition` and `return_remarks` |

---

## Repository

- `complete_return(ctx, row_id, *, status, returned_at, return_remarks)` — return completion update (status, timestamp, remarks).

---

## API

| Endpoint | Change |
|----------|--------|
| `POST /api/v1/assets/asset-assignments` | Body may include `delivery_reference_*`, `assignment_remarks` (unchanged path) |
| `PATCH …/asset-assignments/{id}` | Same enrichment fields; `return_remarks` **not** on update body |
| `POST …/asset-assignments/{id}/return` | **Body required:** `AssetAssignmentReturnRequest` (`return_condition`, `reason`, `return_remarks`) |

---

## Audit

- `create` / `update` — enrichment snapshot in `new_value` where applicable.
- `return` — `return_condition`, `return_remarks`, plus custodian clear payload.
- `assignment_activate` — includes delivery reference fields when present on assignment.

---

## Tests

| Module | Focus |
|--------|--------|
| `test_assignment_enrichment.py` (domain) | Via `test_assignment_business_layer.py` |
| `test_assignment_business_layer.py` | Validator, service, repository, OpenAPI |
| `test_assignment_validator.py` | Existing allocation rules |
| `test_asset_registration_routes.py` | Return request schema + requestBody |
| `test_asset_assignment_workflow.py` | Draft rows include delivery ref for submit |

**Target:** 50+ cases across validator, service, repository, API, audit, and errors (met).

---

## Out of scope (5A-2)

- UI / sidebar / dashboard
- Excel import
- Auto-transition of `delivery_reference_status` on activate (future)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Existing employee drafts with `not_applicable` fail on submit | Update drafts with delivery status before submit; aligns with Excel issue parity |
| Return endpoint now requires JSON body | Clients must send `{}` or explicit `return_condition`; default `good` on schema |
| Strict issued/received requires number | Validation error guides data entry before submit |
