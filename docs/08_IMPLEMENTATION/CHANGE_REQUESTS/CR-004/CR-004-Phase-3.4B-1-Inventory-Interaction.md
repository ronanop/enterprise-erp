# CR-004 Phase 3.4B-1 — Inventory Interaction Layer

**Status:** Complete (components only)  
**Location:** `apps/web/src/components/assets/inventory/interaction/`

---

## Scope

Reusable interaction UI for inventory rows:

- `InventoryActionMenu` — View + overflow menu (permission-gated)
- `AssetDetailDrawer` — right-side drawer with section components
- `mapInventoryRowToDrawerData` — row → drawer DTO (no API)

**Not in this phase:** routing, workflow launch, workspace wiring.

---

## Components

| Component | Purpose |
|-----------|---------|
| `InventoryActionMenu` | View button; ⋮ menu with CR-004 action labels |
| `AssetDetailDrawer` | Overlay + panel; loading skeleton; empty state |
| `SummarySection` | Tag, name, holder, branch, statuses |
| `AssignmentSection` | Employee, issue date, department |
| `ConfigurationSection` | Discovery summary or empty |
| `AdditionalInfoSection` | Earlier used by, challan, remarks |
| `QuickLinksSection` | Portal / Discovery / QR / History buttons (optional handler) |

---

## Permissions

`InventoryActionPermissions` gates menu items. Defaults allow all; parent passes partial overrides.

---

## Tests

`inventory-interaction.test.tsx` — run via `npm run test` in `apps/web`.

---

## Next

**Phase 3.4B-2** — Wire menu + drawer into `AssetInventoryWorkspace` with navigation to existing modules.
