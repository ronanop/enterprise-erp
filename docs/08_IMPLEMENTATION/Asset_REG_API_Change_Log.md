# Asset Registration — API Change Log (FP-ASSET-REG-001)

## Schemas

- `AssetCreate` / `AssetRegistrationCreate` — full FRD registration fields
- `AssetUpdate` / `AssetRegistrationUpdate` — draft-only mutable fields
- `AssetListResult` — paginated list payload
- `GrnPrefillResponse` — GRN prefill DTO

## Endpoints (`/api/v1/assets/assets`)

| Method | Path | Notes |
|--------|------|--------|
| GET | `` | Query: `page`, `page_size`, `status`, `branch_id`, `asset_category_id`, `q` → `AssetListResult` |
| GET | `/registration/prefill?grn_id=` | GRN prefill (create permission) |
| POST | `` | Create draft (system assigns `asset_code`) |
| PATCH | `/{id}` | Update draft |
| POST | `/{id}/submit` | Submit readiness validation |
| POST | `/{id}/approve` | Unchanged semantics (WF-GOV) |
| POST | `/{id}/reject` | Unchanged semantics (WF-GOV) |
| POST | `/{id}/cancel` | Cancel draft |
| POST | `/{id}/reopen` | Reopen rejected registration |
| POST | `/{id}/resubmit` | Reopen (if needed) + submit |

## Errors

- `RegistrationValidationError` → HTTP 422
- `DuplicateAssetRegistrationError` → HTTP 409
