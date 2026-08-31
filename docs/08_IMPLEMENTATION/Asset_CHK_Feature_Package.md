# FP-ASSET-014 — Asset Checklist Management (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-CHK-001

## Scope

Operational checklists linked to assets, maintenance work orders, or audits. Lifecycle: draft → complete or cancel. No approval workflow. No Finance.

## Lifecycle fidelity

- **Draft:** fully editable (`PATCH` with optimistic locking).
- **Complete:** `POST /{id}/complete` — requires all required `items_json` entries to have `result`.
- **Cancel:** `POST /{id}/cancel` — draft only.
- Client cannot override `status` or `completed_at` via create/update.

## API (`/api/v1/assets/asset-checklists`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.checklist:read` |
| GET | `/{id}` | `asset.checklist:read` |
| POST | `/` | `asset.checklist:create` |
| PATCH | `/{id}` | `asset.checklist:update` |
| POST | `/{id}/complete` | `asset.checklist:update` |
| POST | `/{id}/cancel` | `asset.checklist:update` |

List: `page`, `page_size`, `company_id`, `asset_id`, `maintenance_id`, `audit_id`, `branch_id`, `status`, `q`.

Create body requires at least one parent FK plus `checklist_code` and `checklist_name`.

## UI

`AssetChecklistWorkspace` at `/assets/asset-checklists`. Server-side parent pickers, structured `items_json` editor, search/filters/pagination, complete/cancel actions.
