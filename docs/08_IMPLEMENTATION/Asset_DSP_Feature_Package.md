# FP-ASSET-005 — Asset Disposal (Retirement & Disposal Governance)

**Status:** Implemented  
**ADR:** ADR-ASSET-DSP-001

## Scope

Governed asset disposal: draft → submit → workflow → approved → **post** (Finance journal + asset terminal status). Open-disposal exclusivity; blocks for open maintenance, open assignment, and pending transfer; cancel/reopen/resubmit.

## API (`/api/v1/assets/asset-disposals`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.disposal:read` |
| GET | `/{id}` | `asset.disposal:read` |
| POST | `/` | `asset.disposal:create` |
| PATCH | `/{id}` | `asset.disposal:update` |
| POST | `/{id}/submit` | `asset.disposal:submit` |
| POST | `/{id}/approve` | `asset.disposal:approve` |
| POST | `/{id}/reject` | `asset.disposal:approve` |
| POST | `/{id}/cancel` | `asset.disposal:create` |
| POST | `/{id}/reopen` | `asset.disposal:create` |
| POST | `/{id}/resubmit` | `asset.disposal:submit` |
| POST | `/{id}/post` | `asset.disposal:post` |

List query: `page`, `page_size`, `company_id`, `asset_id`, `branch_id`, `status`, `disposal_type`, `q`.

Post body: `debit_account_id`, `credit_account_id`, optional `fiscal_year_id`.

## Workflow

- Code: `AST_DISPOSAL_APPROVAL` (`entity_name`: `ast_asset_disposal`)
- Steps (0266): ASSET_MANAGER → ASSET_ADMIN → ASSET_ADMIN (Finance Review)

## Asset status (on post only)

| disposal_type | Asset status |
|---------------|--------------|
| sale, scrap, donation | `disposed` |
| write_off | `written_off` |

## UI

- Route: `/assets/asset-disposals` → `AssetDisposalWorkspace`

## Migrations

- `0470_ast_disposal_governance` — update permission, open disposal index, ADISP sequence backfill

## Out of Scope

New Finance GL engines, depreciation productization, revaluation, changing WF step topology, new business columns, barcode/RFID.
