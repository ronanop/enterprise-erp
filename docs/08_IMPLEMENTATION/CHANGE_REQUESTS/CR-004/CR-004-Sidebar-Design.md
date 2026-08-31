# CR-004 — Sidebar Design (Locked)

**Module:** Assets (`/assets/*`)  
**Alignment:** Replaces ad-hoc horizontal tabs; single vertical IA for IT Admin + asset accountants.

---

## Locked tree

```text
Dashboard                          → /assets

Assets
  All Assets                       → /assets/assets
  Add Asset                        → /assets/assets/new

Asset Configuration
  Categories                       → /assets/asset-categories
  Asset Types                      → /assets/asset-types
  Locations                        → /assets/locations
  Departments                      → /assets/departments

Operations
  Assignment                       → /assets/asset-assignments
  Transfers                        → /assets/asset-transfers
  Maintenance                      → /assets/asset-maintenances

Lifecycle
  Depreciation                     → /assets/asset-depreciations
  Disposal                         → /assets/asset-disposals
  Revaluation                      → /assets/asset-revaluations

Compliance
  Audits                           → /assets/asset-audits
  Warranties                       → /assets/asset-warranties
  Insurance                        → /assets/asset-insurances

Extended
  Components                       → /assets/asset-components
  Asset Locations                  → /assets/asset-locations
  Maintenance Plans                → /assets/maintenance-plans
  Service History                  → /assets/service-histories
  Checklists                       → /assets/asset-checklists
  Meter Readings                   → /assets/meter-readings
  Documents                        → /assets/asset-documents
  Notifications                    → /assets/asset-notifications

QR / Barcode                       → /assets/qr-barcode

Reports                            → /assets/reports

Settings                           → /assets/settings
```

---

## Rules (freeze)

| Rule | Detail |
|------|--------|
| **No new top-level modules** | Inventory ops views live under Assets / Dashboard, not new sidebar roots |
| **Dashboard single entry** | Only one “Dashboard” link; `/assets` exact match |
| **Operations label** | Freeze label **Assignment** (href unchanged) |
| **RBAC** | Hide group items when user lacks resource read permission (existing module resources) |
| **Active state** | Prefix match for nested routes (e.g. `/assets/assets/*`) |
| **Collapse** | Extended group collapsed by default on tablet; expandable |

---

## Inventory shortcuts (not duplicate nav items)

Operational views (Ready, Assigned, etc.) are **not** separate sidebar nodes in 3.1 freeze. Access via:

- Dashboard KPI clicks
- Optional future “Inventory” subsection under Assets (Phase 3.4) — **secondary** to KPI entry

If product adds subsection later:

```text
Assets
  All Assets
  Ready To Move      → filtered list
  Assigned
  ...
```

Default freeze: **KPI + All Assets only** in sidebar; filtered views via dashboard.

---

## Icon mapping (Lucide — implementation reference)

| Item | Icon |
|------|------|
| Dashboard | `LayoutDashboard` |
| All Assets / Add | `Package` |
| Categories | `FolderTree` |
| Assignment | `UserCheck` |
| QR / Barcode | `QrCode` |
| Reports | `BarChart3` |
| Settings | `Settings` |

(Remaining icons match current `assetManagementNav` in config.)

---

## Relationship to platform shell

- Assets sidebar is **module-local** (inside `/assets` layout).
- Global ERP shell (company switcher) unchanged.
- Branch context synced with dashboard branch filter where possible.

---

## Change control

Any add/remove/rename requires CR-004 product approval + Decision Log entry.
