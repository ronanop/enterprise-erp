# CR-005 Phase 2 — Asset Detail Workspace

**Status:** Complete  
**Date:** 2026-08-06  
**Mode:** Frontend only — reuse existing drawer, mapper, navigation, QR

---

## Mission

Transform the inventory Asset Detail Drawer into an **Enterprise Asset Detail Workspace** opened from the Dashboard register **without leaving `/assets`**.

Row click (or View) → right-side workspace → tabs + bottom actions. No new pages, APIs, or backend.

---

## Workflow

```text
Dashboard (/assets)
  └─ Asset Register (AssetInventoryContainer)
       └─ Click row / View
            └─ AssetDetailDrawer (workspace)
                 ├─ Header (image, QR, barcode, badges, holder)
                 ├─ Tabs (Overview … Documents)
                 └─ Action bar → existing routes
```

---

## Drawer architecture

| Layer | Component | Role |
|-------|-----------|------|
| Shell | `asset-detail-drawer.tsx` | Overlay + responsive panel + tabs + actions |
| Header | `drawer-workspace-header.tsx` | Image placeholder, QR (`qrcode.react`), barcode mark, statuses |
| Tabs | `drawer-workspace-tabs.tsx` | Overview / Configuration / Assignment / History / Timeline / Documents |
| Actions | `drawer-action-bar.tsx` | Assign, Return, Transfer, Maintenance, Portal, Print* |
| Mapper | `inventory-drawer.mapper.ts` | Row → drawer data + config parse + timeline |
| Host | `asset-inventory-workspace.tsx` | Row click opens drawer; ⋮ still works |
| Container | `asset-inventory-container.tsx` | `onDrawerAction` → existing navigation |

### Responsive panel

| Breakpoint | Width |
|------------|-------|
| Mobile | Full screen (`w-full`) |
| Tablet (`md`) | ~50% (`md:w-1/2`) |
| Desktop (`xl`) | ~35% (`xl:w-[35%]`) |

---

## Tabs

| Tab | Content (reused / derived) |
|-----|----------------------------|
| Overview | `SummarySection`, purchase/model, warranty note, location, holder, `AdditionalInfoSection` |
| Configuration | `ConfigurationSection` with CPU / RAM / Storage / OS / Accessories (parsed from config string) |
| Assignment | `AssignmentSection` (current assignment fields) |
| History | `AssignmentHistorySection` (existing history on row) |
| Timeline | `TimelineSection` from `buildDrawerTimeline` (history + ops status — no new API) |
| Documents | `DocumentsSection` — QR, barcode, invoice/attachment placeholders |

---

## Components reused

- `AssetDetailDrawer`, drawer sections, inventory mapper / row VM  
- `StatusBadge`, operational status helpers  
- `QRCodeCanvas` (`qrcode.react`) — same stack as QR workspace / portal  
- `assetNavigationPaths` / `useAssetNavigation` / `handleInventoryMenuWorkflow`  
- Assignment history already on inventory rows  

**Not created:** new pages, APIs, workflows, DB, assignment/return logic, timeline API.

**Delete:** not in existing inventory permissions — omitted from action bar.

**Print Label / QR / Barcode:** navigate to existing `/assets/qr-barcode?assetId=` (no local print business logic).

---

## Row click

- Table row / mobile card click → `onViewRow` → drawer open  
- Expand chevron and ⋮ / View stop propagation so menus still work  

---

## Tests

| Suite | Count (approx) | Focus |
|-------|----------------|-------|
| `inventory-interaction.test.tsx` | **43** | Tabs, header QR/barcode, actions, timeline, mapper, responsive |
| `asset-inventory-workspace.test.tsx` | +2 | Row click opens view callback; chevron isolated |
| `register-parity.test.tsx` | updated | Tab navigation for assignment/history fields |
| Navigation / integration | updated | Portal → **Information Portal** action |

**Target 35+:** met in interaction suite alone (43).

---

## Risks

| Risk | Mitigation |
|------|------------|
| Warranty / invoices not on inventory row | Placeholder copy; no fabricated API |
| Timeline dates incomplete | Uses history timestamps; unknown shown as “Date unknown” |
| Dual QR (header + Documents) | Intentional for header scan + documents tab |
| Canvas warnings in jsdom | Expected without `canvas` package; QR still mounts |
| Branch KPI vs inventory branch still independent | Phase 1 residual; out of Phase 2 scope |

---

## Validation

| Check | Result |
|-------|--------|
| Row click opens drawer (no route change) | Pass |
| Tabs render Overview → Documents | Pass |
| History / Timeline from existing row data | Pass |
| QR / barcode presentational | Pass |
| Bottom actions use existing navigation | Pass |
| Responsive width classes | Pass |
| No backend / new API / new page | Pass |
| Regression (inventory container, integration, parity) | Pass |
