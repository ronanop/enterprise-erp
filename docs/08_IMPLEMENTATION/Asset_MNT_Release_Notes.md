# Asset Maintenance — Release Notes (FP-ASSET-004)

## Highlights

- Governed maintenance work orders with Foundation workflow
- Asset status: start → `in_maintenance`; complete → `active` when no other open WO
- One open work order per asset
- Pending transfer blocks start
- Service history auto-created on complete
- Dedicated Maintenance workspace UI
- Seeded `asset.maintenance:update`

## Breaking API changes

- `POST /asset-maintenances` requires `asset_id`, `maintenance_type` (and related optional fields)
- `GET /asset-maintenances` returns paginated `{ items, total, page, page_size }` instead of a bare list
- New actions: cancel, reopen, resubmit, schedule, start

## Flag

`ASSET_WORKFLOW_GOVERNANCE_ENABLED` — production must be `true`.

## Accepted architectural risk

Open work-order exclusivity is enforced in the application layer (`MaintenanceValidator` / `find_open_for_asset`). Migration `0469` adds a **non-unique** partial index for lookup performance only — it does **not** provide a database UNIQUE constraint. Concurrent create requests can theoretically race; operators should retry on conflict. This matches the Assignment exclusivity approach and is an accepted platform risk for FP-ASSET-004.
