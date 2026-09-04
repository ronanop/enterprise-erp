# CR-004 — Inventory Views (Asset Register Filters)

**Principle:** One register, many views — no new modules or duplicate tables.

---

## View catalog

| View title | Route (proposed) | Query |
|------------|------------------|-------|
| All Assets | `/assets/assets` | (none) |
| Ready To Move | `/assets/inventory/ready-to-move` | `operational_status=READY_TO_MOVE` |
| Assigned | `/assets/inventory/assigned` | `operational_status=ASSIGNED` |
| Retired | `/assets/inventory/retired` | `operational_status=RETIRED` |
| Pending Disposal | `/assets/inventory/pending-disposal` | `operational_status=PENDING_DISPOSAL` |
| Disposed | `/assets/inventory/disposed` | `operational_status=DISPOSED` |

**Implementation note (3.4):** Routes may be implemented as thin wrappers that render the same `AssetListWorkspace` with preset filter — **no new backend**.

Shared query params (all views):

- `branch_id`, `company_id` (scope)
- `q` (search — asset name, code, serial)
- `status` (lifecycle — optional secondary filter)
- `page`, `page_size` (pagination)

**API:** `GET /api/v1/assets/assets`

---

## Page chrome per view

| Element | Behavior |
|---------|----------|
| Title | View name + count badge from list `total` |
| Breadcrumb | Assets → {View} |
| Branch filter | Same control as dashboard (persist in URL) |
| Export | Future — reports module; not 3.1 |

---

## Asset register column matrix

Legend: **V** visible default | **H** hidden (column picker) | **E** expandable row panel | **RO** read-only | **ED** editable (in draft contexts only)

| Customer / Excel field | Register column | Default | Mode | Data source |
|------------------------|-----------------|---------|------|-------------|
| Employee ID | Employee ID | H | RO | Active assignment → `master_employee` |
| Employee Name | Employee Name | V | RO | Derived (assignment + master) |
| Laptop Name | Asset Name | V | RO | `asset_name` |
| Asset Tag | Asset Tag | V | RO | `asset_code` / `barcode` |
| Manufacturer | Manufacturer | V | RO | Product / discovery / portal |
| Model | Model | V | RO | Product / discovery |
| Configuration | Configuration | E | RO | `discovery_profile_json` summary |
| Charger | Charger | E | RO | Components (charger type) |
| Earlier Used By | Earlier Used By | H | RO | Assignment history query |
| Issue Date | Issue Date | V | RO | `allocated_at` (active assignment) |
| Phone Number | Phone | H | RO | Master employee |
| Location | Location | V | RO | Branch name + optional location |
| Delivery Challan | Delivery Challan | H | RO | Assignment/doc (**data gap** per SSOT) |
| Remarks | Remarks | H | RO | Assignment remarks (**gap**) |
| Operational Status | Ops Status | V | RO | `operational_status` |
| Lifecycle Status | Lifecycle | V | RO | `status` |
| Current Holder | Current Holder | V | RO | Derived when `ASSIGNED` (D-014) |
| Branch | Branch | V | RO | `branch_id` → org |

### Expandable row (E)

On row expand (desktop) or detail sheet (mobile):

- Full configuration snippet (discovery)
- Accessories list (components)
- Link to Information Portal / Self-Service

**API for expand:** `GET /assets/assets/{id}/information-portal` (existing CR-002).

### Editable fields

Grid inline edit **not** in IT inventory views. Edits only via:

- Asset detail / registration wizard (draft)
- Assignment / return workflows

---

## List vs Excel export

Daily grid uses **visible** columns above. Full Excel parity export remains **Reports** (future IT register composer) — not blocking 3.4 list.

---

## Empty states

| View | Message |
|------|---------|
| Ready To Move | “No assets ready for assignment in this branch.” |
| Assigned | “No assigned assets — check Ready To Move queue.” |
| Pending Disposal | “No assets marked for disposal.” |

---

## API gaps (document only)

| Need | Gap | Workaround in UI |
|------|-----|------------------|
| Employee name in list row | No list DTO with joins | Show “—” until expand/portal; or batch portal (N+1 risk — avoid) |
| Current holder in list | Not on `AssetResponse` | Derive client-side only if assignment id embedded — **prefer** Phase 3.4 lazy column via small batch read API later (out of 3.1) |
| Sort by `created_at` | Not documented on list API | Sort client-side on current page or request backend `sort` in future CR |

---

## RBAC

All views: `asset.asset:read`.
