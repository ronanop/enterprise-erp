# CR-004 — Asset Navigation

**Owner:** `apps/web/src/components/assets/navigation/asset-navigation.ts`  

All IT asset module URLs must be built and invoked through this module (or `useAssetNavigation` in client containers).

---

## API

| Method | Target module |
|--------|----------------|
| `openInventory()` | `/assets/assets` |
| `openDetails(id)` | Asset detail workspace |
| `openAssignment(id)` | Issue wizard via AssignmentNavigation (`/new?assetId=`) |
| `openReturn(id)` | Return wizard via AssignmentNavigation (`/return?assetId=&intent=return`) |
| `openPortal(id)` | CR-002 Information Portal |
| `openDiscovery(id)` | Asset detail (CR-003 discovery panel) |
| `openQr(id)` | QR / Barcode workspace |
| `openTransfer(id)` | Transfer workspace |
| `openMaintenance(id)` | Maintenance workspace |
| `openHistory(id)` | Asset detail activity (`?tab=activity`) |

---

## Dispatch helpers

- `dispatchInventoryMenuAction(navigation, action, assetId)`
- `dispatchInventoryQuickLink(navigation, link, assetId)`

---

## Rules

- **No** `router.push` / `<Link href>` for asset ops inside presentational components.
- Containers call `useAssetNavigation()` once and pass callbacks to workspace/interaction UI.
