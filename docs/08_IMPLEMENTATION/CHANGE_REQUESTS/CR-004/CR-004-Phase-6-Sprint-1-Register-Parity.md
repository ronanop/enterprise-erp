# CR-004 Phase 6 Sprint 1 — Register Parity Completion

**Date:** 2026-08-05  
**Scope:** Frontend UI exposure only — no backend / API / schema / reports / import  
**Closes:** Business Validation High gaps H-1 (Earlier Used By), H-2 (challan/remarks in inventory drawer)

---

## Objective

Surface existing assignment enrichment and history on the Inventory Register, Inventory Drawer, and Asset Detail so the ERP register matches customer Excel columns for **live** assets (without duplicating data).

---

## Register Parity Mapping

| Excel column | ERP source | UI surface | Derived? |
|--------------|------------|------------|----------|
| Employee ID | Active assignment `employee_id` | Inventory column | Yes |
| Current Holder / Employee Name | `assignee_label` or `/employees` label map | Inventory + drawer + detail | Yes |
| Laptop Name | `asset_name` | Inventory | No |
| Asset Tag | `asset_code` | Inventory | No |
| Brand / Model / Configuration | Discovery profile | Inventory + drawer | Yes |
| Issue Date | `allocated_at` | Inventory + drawer | Yes |
| Branch / Location | `branch_id` → org | Inventory | Yes |
| Department | `department_id` → org | Inventory | Yes |
| Earlier Used By | Prior **returned** assignment assignee | Expand row, drawer Register fields, Asset Detail | Yes (history) |
| Delivery Challan / Reference | `delivery_reference_number` + status | Expand, drawer Assignment, Asset Detail | No |
| Assignment Remarks | `assignment_remarks` (issued-items prefix stripped) | Expand, drawer, detail | No |
| Return Remarks | Latest returned `return_remarks` | Expand, drawer, history, detail | No |
| Ops bucket | `operational_status` | Inventory presets / badges | No |
| Phone Number | Employee master (not on assignment list) | Shown as `—` until master phone join | Yes (placeholder) |

SSOT helpers: `apps/web/src/components/assets/inventory/register-parity.ts` (`REGISTER_PARITY_FIELDS`).

---

## Implementation

### Derivation (client read model)

1. Inventory already loads assignment list (`listAssignments`, page_size 500).
2. Group all rows by `asset_id` (`groupAssignmentsByAssetId`).
3. Active map still used for Current Holder.
4. History map drives Earlier Used By, delivery, remarks, history panel.
5. Optional `listEmployeeOptions()` labels resolve `employee_id` → display name (existing API).

### UI

| Surface | Change |
|---------|--------|
| Inventory expandable row | Earlier Used By, Delivery Reference/Status, Assignment Remarks, Return Remarks |
| Inventory Drawer — Assignment | Delivery reference/status, assignment + return remarks |
| Inventory Drawer — Register fields | Earlier Used By + delivery + remarks (renamed from “Additional”) |
| Inventory Drawer — Assignment history | New section; return remarks per historical row |
| Asset Detail — Overview | Register parity card |
| Asset Detail — Assignment history tab | Rich table with delivery + remarks |

---

## Out of scope (confirmed)

- Backend / DB / new APIs  
- Reports / Excel import  
- Dashboard / Sidebar  
- New workflows  
- Phone number enrichment beyond placeholder  

---

## Tests

Primary suite: `register-parity.test.tsx` (40+ assertions covering derivation, empty states, drawer, history, responsive grid, mapper coverage).

Regression: inventory mapper, interaction, workspace, container, integration mocks updated for expandable shape + `listEmployeeOptions`.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Assignment list page_size 500 may miss old history for large branches | Accept for Sprint 1; Phase 7 may add asset-scoped history fetch |
| Employee labels truncated to first 200 employees | Same as wizard; IDs still shown as fallback |
| Phone still `—` | Documented; needs employee master field in a later sprint |
| Dual display of remarks (Assignment + Register fields) | Intentional Excel parity; read-only |

---

## Validation

- [x] Earlier Used By derived from returned history  
- [x] Delivery reference number + status from assignment  
- [x] Assignment remarks + return remarks read-only in drawer/detail  
- [x] No duplicate custody storage  
- [x] No backend changes  
- [x] 40+ tests green  

**H-1 / H-2 status:** Closed for UI register parity on live ERP data.
