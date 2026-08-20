# Change Request Implementation Summary

**Module:** Asset Management  
**Baseline:** Post FP-ASSET-019 Enterprise Audit

---

## CR-001 — Asset Category Management Enhancement

**Status:** Completed (2026-07-30)

### Delivered

- Completed category Create/Update/Response schemas
- `AssetCategoryService.deactivate` / `reactivate` with operational-asset reference guard
- Additive API: `POST .../deactivate`, `POST .../reactivate`; list supports `status` and `q`
- Dedicated Asset Category workspace
- Registration form category dropdown shows **active** categories only
- Doc: `CR-001-Asset-Category-Enhancement.md`

---

## CR-002 — Asset Information Portal + QR Self-Service

**Status:** Completed (2026-07-31)

### Delivered

- Asset Information Portal + dynamic QR + authenticated self-service
- Additive APIs: `GET .../information-portal`, `GET .../self-service`
- Doc: `CR-002-Asset-Information-Portal.md`

---

## CR-003 — Asset Discovery Module

**Status:** Completed (2026-07-31)

### Delivered

- Platform command generator (Windows / Linux / macOS)
- Pure `HardwareInventoryParser` + `DiscoveryValidator` + `AssetDiscoveryService`
- `AssetService.apply_discovery_profile` (allowlisted fields only)
- Preview (`parse`) then Apply (`preview_confirmed` required)
- JSONB `discovery_profile_json` on `ast_asset` (migration `0485`)
- Discovery section embedded in Information Portal
- Audit `discovery_apply`
- Doc: `CR-003-Asset-Discovery.md`

### Non-goals respected

- No column explosion
- No automatic persistence on parse
- No workflow / finance / category / assignment updates
- Parser has no repository access

### Validation

| Check | Result |
|-------|--------|
| Architecture layers intact | Pass |
| No workflow changes | Pass |
| Existing APIs compatible | Pass |
| Allowlist enforced | Pass |
| Preview required before apply | Pass |
| CR-001 / CR-002 compatible | Pass |

---

## CR-005 — Asset Operations Workspace

**Phase 1 status:** Complete (2026-08-06) — Dashboard Workspace Foundation (frontend layout)  
**Phase 2 status:** Complete (2026-08-06) — Asset Detail Workspace (tabbed drawer)  
**Phase 3 status:** Complete (2026-08-06) — Dashboard Operations Panel  
**Phase 4 status:** Complete (2026-08-06) — Workspace Experience & Productivity Polish

### Delivered (Phase 1)

- Converted `/assets` dashboard into Asset Operations Workspace layout
- Header: title, workspace subtitle, Branch Selector, Refresh
- KPI strip via existing dashboard-summary API + `StatCard` (order locked)
- Embedded existing `AssetInventoryContainer` below KPIs (no new table/page/API)
- Doc: `CR-005/CR-005-Phase-1-Dashboard-Workspace-Foundation.md`

### Delivered (Phase 2)

- Asset Detail Workspace inside existing drawer (no page leave)
- Row click opens drawer; ⋮ menu retained
- Tabs: Overview, Configuration, Assignment, History, Timeline, Documents
- Header QR/barcode + bottom actions via existing navigation routes
- Doc: `CR-005/CR-005-Phase-2-Asset-Detail-Workspace.md`

### Delivered (Phase 3)

- Operations quick actions (Add / Allocate / Return / Import / Export) → existing routes/workflows
- Recent Activity panel (max 10) from existing list APIs
- Unified branch state for KPIs, inventory, activity
- Asset Register section chrome (removed duplicate inventory page title when embedded)
- Doc: `CR-005/CR-005-Phase-3-Dashboard-Operations-Panel.md`

### Delivered (Phase 4)

- Sticky operations toolbar with unified global search (reuses inventory `q`)
- Compact Asset Health + Pending Actions widgets from existing KPIs/queues
- Smart empty states; drawer sticky actions; Today/Yesterday/Earlier activity grouping
- Doc: `CR-005/CR-005-Phase-4-Workspace-Polish.md`

### Entry routes

- `/assets` — simple 3-module hub (Asset · Asset Allocation · Add Asset)
- `/assets/operations` — full CR-005 Operations Workspace

### Non-goals respected

- No backend / API schema changes
- No duplicate pages, forms, or workflow engines

---

## Pending

### CR-004 — IT Asset Operations & Inventory Management

**Status:** Substantially complete through Phase 8C — see `CR-004/CR-004-Implementation-Summary.md`

Folder: `docs/08_IMPLEMENTATION/CHANGE_REQUESTS/CR-004/`
