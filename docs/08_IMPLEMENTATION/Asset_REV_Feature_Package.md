# FP-ASSET-007 — Asset Revaluation (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-REV-001

## Scope

Governed asset revaluation: draft → submit → workflow → approved → **post** (Finance journal + `current_book_value` sync). Open-revaluation exclusivity; open-disposal gate; cancel/reopen/resubmit.

## API (`/api/v1/assets/asset-revaluations`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.revaluation:read` |
| GET | `/{id}` | `asset.revaluation:read` |
| POST | `/` | `asset.revaluation:create` |
| PATCH | `/{id}` | `asset.revaluation:update` |
| POST | `/{id}/submit` | `asset.revaluation:submit` |
| POST | `/{id}/approve` | `asset.revaluation:approve` |
| POST | `/{id}/reject` | `asset.revaluation:approve` |
| POST | `/{id}/cancel` | `asset.revaluation:create` |
| POST | `/{id}/reopen` | `asset.revaluation:create` |
| POST | `/{id}/resubmit` | `asset.revaluation:submit` |
| POST | `/{id}/post` | `asset.revaluation:post` |

List query: `page`, `page_size`, `company_id`, `asset_id`, `branch_id`, `status`, `q`.

Create body: `branch_id`, `asset_id`, `new_book_value`, `reason`, optional `revaluation_date` / `company_id`.

**Submit requires `revaluation_date`** (set on draft before submit). Draft save may omit the date.

Post body: `debit_account_id`, `credit_account_id`, optional `fiscal_year_id`.

## Workflow

- Code: `AST_REVALUATION_APPROVAL` (`entity_name`: `ast_asset_revaluation`)
- Reject → cancelled + rejected; reopen/resubmit parity with Disposal

## Asset book value

On successful Finance post only: `ast_asset.current_book_value = new_book_value`.

## UI

`AssetRevaluationWorkspace` at `/assets/asset-revaluations`.
