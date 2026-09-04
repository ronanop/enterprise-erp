# CR-004 Phase 4.1 — Excel Migration Architecture (Gap Analysis)

**Date:** 2026-08-03  
**Mode:** Analysis only — **no implementation**  
**Scope:** Assignment module vs customer Excel workflow; migration architecture  
**Baseline:** Phases 2A–2C (operational status), 3.4 (inventory register), locked D-001–D-014

---

## Executive summary

The customer’s **Employee Asset Register** is a single Excel grid plus **bucket tabs** (Ready To Move, Assigned, Not Given To Anyone, Not Working). The platform already models custody through **`ast_asset_assignment`** documents and IT buckets through **`ast_asset.operational_status`** (CR-004 Phases 2–3). **Inventory and dashboard UX** (Phase 3.4) expose Excel-like views; the **Assignment workspace** still reflects generic FP-ASSET allocation (employee/department/project/branch) rather than the Excel issue/return narrative.

**Migration is not a new module.** It is **field ownership discipline**, **assignment enrichment** (challan, remarks), **return-outcome UX** aligned to Excel tabs, and a **one-time import** into existing tables (roadmap Phase 7).

| Area | Verdict |
|------|---------|
| Core custody & issue date | **Implemented** (`ast_asset_assignment`, `allocated_at` on activate) |
| Excel bucket semantics | **Implemented** (`operational_status` + inventory presets) |
| Register column parity | **Partial** (derived columns; challan/remarks/history gaps) |
| Assignment UI vs Excel | **Gap** (no challan/remarks; return always “good”; no return condition) |
| Excel import | **Not started** (architecture only in this phase) |

---

## 1. Current Assignment module (as built)

### 1.1 Persistence (`ast_asset_assignment`)

| Field | Purpose |
|-------|---------|
| `document_number` | Governance doc id (`AASN-*`) — not in Excel |
| `asset_id` | Link to register row |
| `allocation_type` | `employee`, `department`, `project`, `branch`, `warehouse` |
| `employee_id` / `department_id` / `project_id` | Allocatee |
| `allocated_at` | Set on **activate** (system timestamp) — Excel **Issue Date** |
| `expected_return_at` | Optional — partial Excel equivalent |
| `returned_at` | Set on return |
| `status` | `draft` → … → `active` / `returned` / `cancelled` |
| `workflow_*` | Platform workflow — **not in Excel** |

**Absent (locked for Phase 5 — D-010):** `delivery_challan_ref`, `remarks`.

### 1.2 Service behavior

| Event | Service | Excel mapping |
|-------|---------|----------------|
| Create / update draft | `AssignmentService.create/update` | Pre-issue (not in register row until active) |
| Submit / approve | Workflow + `_activate_assignment` | Issue to employee |
| Activate | Sets `allocated_at`, `custodian_employee_id`, `operational_status → ASSIGNED` | **Assigned Assets** tab |
| Return | `return_assignment(return_condition=…)` | Should drive Ready / Retired / Not Working |

**Gap:** HTTP `POST …/return` does **not** accept `return_condition`; UI always calls return with default **`good`** → only **Ready To Move** path is reachable from the UI.

### 1.3 UI (`asset-assignment-workspace.tsx`)

- Form: asset, branch, allocation type, employee/department/project, expected return.
- **No** delivery challan, issue remarks, or backdated issue date.
- Return: single button; **no** good / outdated / dead (Excel tab outcomes).

### 1.4 Related platform capabilities (not Assignment-owned)

| Excel concept | Where it lives today |
|---------------|----------------------|
| Laptop name, asset tag | `ast_asset` |
| Brand, model, configuration | Product master + `discovery_profile_json` |
| Charger, other items | `ast_asset_component` |
| Branch | `ast_asset.branch_id` (+ assignment `branch_id` scoped) |
| Employee ID, name, phone | `master_employee` (read joins) |
| Earlier used by | Prior `ast_asset_assignment` rows (query) |
| Disposed | Disposal + `operational_status = DISPOSED` |

---

## 2. Customer Excel workflow (target)

```text
Register device (one row per laptop)
    → Ready To Move (branch stock)
    → Assign (employee, issue date, challan, remarks)
    → Assigned (in use)
    → Return → Ready OR Retired (“Not Given To Anyone”) OR Pending disposal (“Not Working”)
    → Disposal → Disposed
```

**Parallel filter:** Branch (Noida, Mumbai, Dubai) on every view.

Excel treats the **register row** as editable truth. ERP treats **assignment documents** + **operational status** as truth.

---

## 3. Gap analysis

### 3.1 Missing fields (vs Excel register)

| Gap | Classification | Remediation phase |
|-----|----------------|-------------------|
| Delivery challan | Missing on ORM/API/UI | Phase 5 (D-010) |
| Issue remarks | Missing on ORM/API/UI | Phase 5 (D-010) |
| Return condition in API/UI | Partial (service only) | Phase 5 + Assignment UX |
| User-editable issue date | Missing (system `allocated_at`) | Policy: optional `allocated_at` on activate or import mapping |
| “Earlier used by” in list/drawer | Partial (placeholder `—`) | Phase 5 read API / composer |
| IT register Excel export | Missing | Phase 7 report composer |
| One-time Excel import | Missing | Phase 7 (`CR-004-Excel-Migration-Plan.md`) |

### 3.2 Duplicate / drift risks

| Data | Risk | Correct ownership |
|------|------|-------------------|
| Employee name / phone on asset row | Excel habit | **Employee** master only; **Derived** at read |
| `custodian_employee_id` on `ast_asset` | Mirrors assignment | **Assignment** authority; asset field is legacy sync (D-014) |
| Brand/model on assignment | Excel row duplication | **Derived** from product/discovery |
| Configuration on asset custom columns | Duplicate discovery | **Asset Master** via `discovery_profile_json` only |
| Second “issued assets” table | Shadow register | **Forbidden** — use assignment history |

### 3.3 Derived fields (do not migrate as columns)

| Excel column | Derivation rule |
|--------------|-----------------|
| Employee Name | Active assignment → `master_employee` |
| Phone Number | Same |
| Current Holder | `ASSIGNED` + active employee assignment (D-014) |
| Brand / Model | Product adapter + discovery hardware |
| Configuration | Summary of `discovery_profile_json` |
| Earlier Used By | Last returned employee assignment before current |
| Ops bucket label | `operational_status` |
| Branch name | `branch_id` → org branch |

### 3.4 Incorrect ownership (if Excel were imported literally)

| Anti-pattern | Why wrong | Target owner |
|--------------|-----------|--------------|
| Store holder name on `ast_asset` | Drift vs HR | **Derived** |
| Store phone on assignment | Drift vs master | **Employee** |
| Put challan on asset row | Issue-specific | **Assignment** |
| Put “Not Working” only in maintenance | Ops bucket | **Asset Master** `operational_status` |
| Free-text “earlier used by” | Not auditable | **Assignment History** query |

### 3.5 Workflow gaps

| Excel behavior | Platform today | Gap |
|----------------|----------------|-----|
| Move row between tabs | Change `operational_status` via workflows | **Return outcomes** not exposed in UI/API |
| Edit row in place | Document draft + approval | Training / simplified IT path (governance toggle) |
| Assign without challan/remarks | Allowed | Fields missing |
| Retire stock without assign | `RETIRED` transition | No dedicated IT command in UI (matrix allows from `READY_TO_MOVE`) |
| Not working → disposal | `PENDING_DISPOSAL` → disposal post | Return `dead` not wired from UI |
| Single employee allocation | Supported | Other allocation types are **Not Required** for Excel parity |

---

## 4. Ownership matrix (Excel columns)

Legend: **AM** Asset Master · **AS** Assignment · **AH** Assignment History · **EM** Employee · **BR** Branch · **DV** Derived · **NR** Not Required

| Excel / register column | Owner |
|-------------------------|--------|
| Employee ID | **EM** |
| Employee Name | **DV** (EM) |
| Phone Number | **DV** (EM) |
| Laptop Name | **AM** (`asset_name`) |
| Asset Tag | **AM** (`asset_code` / barcode) |
| Brand | **DV** (product / discovery) |
| Model | **DV** (product / discovery) |
| Configuration | **DV** (discovery on AM) |
| Charger | **AM** (components child rows) |
| Other Items | **AM** (components) |
| Issue Date | **AS** (`allocated_at`) |
| Location (branch) | **BR** on **AM** |
| Location (desk/site) | **AM** / org location (optional) |
| Earlier Used By | **DV** (**AH**) |
| Delivery Challan | **AS** (planned `delivery_challan_ref`) |
| Remarks | **AS** (planned `remarks`) |
| Current Holder | **DV** (**AS** + ops status) |
| Ready / Assigned / Retired / Not Working / Disposed | **AM** (`operational_status`) |
| Lifecycle (finance) | **AM** (`status`) — **NR** for daily IT Excel |
| Assignment document # | **AS** — **NR** in Excel |
| Workflow status | **NR** |
| Department (org) | **EM** / org — **DV** in register |
| Expected return | **AS** — **NR** in typical Excel |

Full matrix detail: `CR-004-Assignment-Data-Model.md`.

---

## 5. Recommended data model (summary)

- **No new custody table.** Extend **`ast_asset_assignment`** only for issue-specific attributes (D-010).
- **No Excel row table.** Import maps rows → `ast_asset` + optional `ast_asset_component` + historical `ast_asset_assignment` rows.
- **Operational status** remains on **`ast_asset`**; import must set status from Excel tab name using locked backfill rules.
- **Read model** for export: composer joining AM + AS + EM + components (see `CR-004-Assignment-SSOT.md`).

---

## 6. Migration strategy (summary)

| Stage | Action |
|-------|--------|
| **4.1 (this phase)** | Lock ownership, gaps, workflows — documentation |
| **5** | Schema + API + UI for challan, remarks, return condition |
| **7** | Import template, validation, dry-run, reconcile ops vs assignment |
| **Cutover** | Freeze Excel; import; reconciliation job; sign-off on bucket counts |

Detail: `CR-004-Excel-Migration-Plan.md`.

---

## 7. Validation checklist (pre-import)

- [ ] Every Excel column mapped to exactly one owner category
- [ ] No employee PII copied onto `ast_asset`
- [ ] Active rows: one active assignment per asset max
- [ ] Tab → `operational_status` mapping documented
- [ ] Challan/remarks land on assignment rows, not assets
- [ ] Components parsed to `ast_asset_component`, not free text on asset

---

## 8. References

- `CR-004-Assignment-Data-Model.md`
- `CR-004-Assignment-Workflow.md`
- `CR-004-Excel-Migration-Plan.md`
- `CR-004-Assignment-SSOT.md`, `CR-004-Gap-Analysis.md`, `CR-004-Workflow-Analysis.md`
- `apps/api/src/modules/asset/models/asset_assignment.py`
- `apps/api/src/modules/asset/service/assignment_service.py`
