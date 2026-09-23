# CR-004 — Assignment Data Model (Excel Alignment)

**Phase:** 4.1 — Architecture documentation  
**Status:** Current state + target state for Excel migration  
**Authority:** `CR-004-Decision-Log.md` D-010, D-014; ERD_15 §6.4

---

## 1. Purpose

Define how **custody and issue metadata** are stored relative to the customer Excel register row, without duplicating employee or hardware master data.

---

## 2. Entity relationship (conceptual)

```text
master_employee ─────┐
                     │ employee_id
org_branch ──────────┼──► ast_asset ◄──── asset_id ──── ast_asset_assignment
                     │         │                              │
                     │         ├── operational_status         ├── allocated_at (issue)
                     │         ├── asset_code (tag)           ├── returned_at
                     │         ├── asset_name (laptop)        ├── status (doc)
                     │         ├── branch_id                    ├── delivery_challan_ref (planned)
                     │         ├── discovery_profile_json       └── remarks (planned)
                     │         └── custodian_employee_id (mirror)
                     │
ast_asset_component ─┘ (charger, accessories)
```

**Assignment History** = all `ast_asset_assignment` rows for an `asset_id`, ordered by `allocated_at` / `returned_at`.

---

## 3. `ast_asset_assignment` — current vs target

### 3.1 Current (implemented)

| Column | Type | Excel role | Owner |
|--------|------|------------|--------|
| `id` | UUID | — | AS |
| `document_number` | string | — | AS (NR in Excel) |
| `asset_id` | FK | Implicit row key | AS |
| `allocation_type` | enum string | Usually `employee` | AS |
| `employee_id` | FK nullable | Employee ID | AS → **EM** |
| `department_id` | FK nullable | — | NR for Excel |
| `project_id` | UUID nullable | — | NR for Excel |
| `allocated_at` | timestamptz | Issue Date | AS |
| `expected_return_at` | date | Rare in Excel | AS |
| `returned_at` | timestamptz | End of issue | AS |
| `status` | string | In use vs returned | AS |
| `workflow_status` | string | — | NR |
| `workflow_instance_id` | FK | — | NR |
| Tenant scope | mixin | — | AS |

### 3.2 Target additive (Phase 5 — locked D-010)

| Column | Type | Excel role | Owner |
|--------|------|------------|--------|
| `delivery_challan_ref` | string(100) nullable | Delivery Challan | AS |
| `remarks` | text nullable | Remarks (issue) | AS |

**Optional:** FK to `asset-documents` for scanned challan PDF — document module owns bytes; assignment holds reference only.

### 3.3 API DTO alignment

| DTO | Current fields | Target |
|-----|----------------|--------|
| `AssetAssignmentCreate` | asset, branch, allocatee, expected_return | + `delivery_challan_ref`, `remarks` (draft) |
| `AssetAssignmentUpdate` | same | + editable challan/remarks in draft |
| `AssetAssignmentResponse` | no challan/remarks | expose new columns read-only after activate |
| Return body | **none** (router) | `return_condition`, `reason`, `remarks` (return) |

---

## 4. `ast_asset` — fields Excel users see on same row

| Column | Excel column | Owner | Notes |
|--------|--------------|--------|-------|
| `asset_code` | Asset Tag | **AM** | Import key candidate |
| `asset_name` | Laptop Name | **AM** | |
| `serial_number` | Sometimes in Excel | **AM** | |
| `barcode` | Alternate tag | **AM** | |
| `branch_id` | Location (branch) | **AM** / **BR** | |
| `department_id` | Department | **AM** | Org structure |
| `operational_status` | Tab / bucket | **AM** | READY, ASSIGNED, RETIRED, PENDING_DISPOSAL, DISPOSED |
| `status` | Lifecycle | **AM** | Finance register; import → `active` for IT stock |
| `discovery_profile_json` | Configuration source | **AM** | Not assignment |
| `custodian_employee_id` | — | **Mirror** | Set on activate; **not** IT SSOT (D-014) |

---

## 5. Employee master (`master_employee`)

| Excel column | Storage | Owner |
|--------------|---------|--------|
| Employee ID | `employee_code` or id | **EM** |
| Employee Name | name fields | **EM** |
| Phone Number | contact fields | **EM** |

**Rule:** Assignment stores **`employee_id` only**. Import must resolve ID via master lookup, not embed names.

---

## 6. Branch (`organization.org_branch`)

| Excel column | Storage | Owner |
|--------------|---------|--------|
| Noida / Mumbai / Dubai | `branch_id` on asset | **BR** on **AM** |

Assignment `branch_id` must match asset branch at create (validator). Import sets asset branch first.

---

## 7. Derived read model (register / export)

Composer inputs — **no new tables**:

| Output column | Sources |
|---------------|---------|
| Employee Name | AS.active + EM |
| Phone | EM |
| Current Holder | DV rule D-014 |
| Brand / Model | `product_id`, discovery |
| Configuration | `discovery_profile_json` |
| Earlier Used By | AH: last returned employee assignment |
| Issue Date | AS.`allocated_at` |
| Delivery Challan | AS.`delivery_challan_ref` |
| Remarks | AS.`remarks` |
| Charger / Other | Component query by type |

---

## 8. Assignment History semantics

| Concept | Definition |
|---------|------------|
| **Current issue** | Single row `status = active` per asset (enforced by validator) |
| **Historical issue** | `status = returned` rows |
| **Earlier used by** | Employee on most recent **returned** row before current active (or last returned if unassigned) |
| **Audit trail** | Platform audit + `operational_status` audit (Phase 2B-2) |

History rows are **immutable** after return; corrections via reversing documents (platform policy), not Excel-style overwrite.

---

## 9. Import row → table mapping (logical)

| Excel row state | `ast_asset` | `ast_asset_assignment` |
|-----------------|-------------|---------------------------|
| Ready To Move | `operational_status=READY_TO_MOVE`, no active AS | None active |
| Assigned | `ASSIGNED` | One `active`, `allocated_at` = Issue Date |
| Not Given To Anyone | `RETIRED` | No active; optional last returned AS |
| Not Working | `PENDING_DISPOSAL` | Returned; disposal optional |
| Disposed | `DISPOSED`, `status=disposed` | No active |

---

## 10. Duplicate field policy

| Field pair | Policy |
|------------|--------|
| `custodian_employee_id` vs `assignment.employee_id` | Keep sync on activate/return; UI uses **Derived** Current Holder |
| `asset.department_id` vs `assignment.department_id` | Excel uses org department on register; department allocation type is **NR** for IT Excel |
| Product vs discovery brand/model | Discovery wins for IT hardware after CR-003 apply |

---

## 11. Not Required for Excel parity

- `project_id`, `warehouse` allocation types
- `workflow_status` / `workflow_instance_id` (keep for governance)
- Finance fields on asset (cost, depreciation) unless finance cutover same project
- `expected_return_at` unless customer adopts policy

---

## 12. References

- ORM: `apps/api/src/modules/asset/models/asset_assignment.py`
- Schemas: `apps/api/src/modules/asset/schemas.py` (`AssetAssignment*`)
- SSOT: `CR-004-Assignment-SSOT.md`
