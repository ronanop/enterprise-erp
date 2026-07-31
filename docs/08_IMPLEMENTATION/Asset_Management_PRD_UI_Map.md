# Asset Management PRD — UI field map

Version: 1.0 (UI-first phase). Backend remains FP-ASSET / FRD-12; this document tracks PRD presentation vs API.

## Navigation (implemented)

| PRD item | Route | API / notes |
|----------|-------|-------------|
| Dashboard | `/assets` | `loadAssetManagementDashboard()` — categories, assets, assignments, maintenances only |
| All Assets | `/assets/assets` | `GET /assets/assets` |
| Add Asset | `/assets/assets/new` | `POST /assets/assets` (+ submit/approve optional) |
| Categories | `/assets/asset-categories` | `GET /assets/asset-categories` |
| Asset Types | `/assets/asset-types` | UI catalog [`asset-prd-types.ts`](../../apps/web/src/config/asset-prd-types.ts) — no DB master yet |
| Locations | `/assets/locations` | Organization `GET /locations` via ResourceListView |
| Departments | `/assets/departments` | Organization `GET /departments` |
| Asset Assignment | `/assets/asset-assignments` | `GET/POST /assets/asset-assignments`, `POST …/return` |
| Maintenance | `/assets/asset-maintenances` | `GET/POST /assets/asset-maintenances` |
| QR / Barcode | `/assets/qr-barcode` | Self-service URL + information portal |
| Reports | `/assets/reports` | Subset of report catalog keys (inventory, allocation, maintenance_due, warranty_expiry) |
| Settings | `/assets/settings` | Read-only governance notes |

## PRD status mapping

| PRD status | Derivation |
|------------|------------|
| Available | `active` / `transferred` without active assignment |
| Assigned | Active assignment on asset |
| Reserved | `draft`, `submitted`, or `approved` asset |
| Under Maintenance | `in_maintenance` |
| Lost | `cancelled` (approximation) |
| Disposed | `disposed`, `written_off` |

## Form fields — gaps

| PRD field | API / UI source | Gap |
|-----------|-----------------|-----|
| Asset code | `asset_code` (server-generated on create) | User-entered code not on `AssetCreate` schema |
| Brand / model | `discovery_profile_json` | No dedicated columns on `ast_asset` |
| Condition | — | Not persisted |
| Asset image | — | Not persisted |
| Building / floor / room | Wizard → `POST /assets/asset-locations` | Detail shows current `location_label` |
| Lost / Reserved | Mapped heuristically | No first-class PRD enum in DB |

## Removed from UI (APIs unchanged)

Depreciation, insurance, transfers, disposals, audits, components, maintenance plans, service history, checklists, meters, notifications, standalone documents nav.

## Follow-up (backend)

- `ast_asset_type` master linked to category
- PRD condition and physical location fields
- Optional: map PRD statuses to dedicated workflow states
