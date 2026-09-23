# CR-004 — Gap Analysis

**Classification:** Already Implemented | Needs Enhancement | Missing | Future Scope

---

## 1. Employee Asset Register (Excel row)

| Requirement | Classification | Notes |
|-------------|----------------|-------|
| Employee ID / Name | **Already Implemented** | `master_employee`; assignment `employee_id` |
| Phone | **Already Implemented** | Employee master (read via adapters) |
| Laptop name | **Needs Enhancement** | Use `asset_name`; IT-friendly labels in UI |
| Asset tag | **Already Implemented** | `asset_code` / `barcode` |
| Brand / Model | **Partial** | `product_id` + portal adapters; discovery MANUFACTURER/MODEL |
| Configuration | **Partial** | `discovery_profile_json` hardware section |
| Charger / Other items | **Needs Enhancement** | Components workspace; link UX from register |
| Issue date | **Already Implemented** | `allocated_at` on assignment |
| Location | **Partial** | `branch_id`, org locations, `ast_asset_location` |
| Earlier used by | **Needs Enhancement** | Assignment history query; no Excel column |
| Delivery challan | **Missing** | Add optional reference on assignment or document link |
| Remarks | **Missing** | Assignment or asset ops extension field (single SSOT) |

---

## 2. Operational buckets (Excel tabs)

| Excel bucket | Classification | Target |
|--------------|----------------|--------|
| Ready To Move | **Missing** | `operational_status = READY_TO_MOVE` + filters |
| Assigned Assets | **Partial** | Active assignments exist; ops status + register view |
| Not Given To Anyone | **Missing** | `RETIRED` |
| Not Working | **Partial** | Maintenance exists; link to `PENDING_DISPOSAL` |
| Disposed (implied) | **Already Implemented** | Disposal + `asset.status = disposed` |

---

## 3. Branch inventory

| Requirement | Classification | Notes |
|-------------|----------------|-------|
| Noida / Mumbai / Dubai | **Partial** | `branch_id` on `ast_asset`; needs dashboard filter + inventory KPI |
| Per-branch ready count | **Missing** | Derived metric |
| Per-branch assigned count | **Partial** | Query active assignments by branch |

---

## 4. Module features (existing)

| Feature | Classification | CR-004 impact |
|---------|----------------|---------------|
| Categories (CR-001) | **Already Implemented** | IT asset types via categories |
| Information Portal (CR-002) | **Already Implemented** | Show operational status when added |
| Discovery (CR-003) | **Already Implemented** | Feeds configuration |
| QR | **Already Implemented** | No change |
| Transfers | **Already Implemented** | Branch moves |
| Depreciation / Insurance / Warranty | **Already Implemented** | Lifecycle sidebar; not IT-admin primary |
| Audits | **Already Implemented** | Compliance |
| Reports | **Already Implemented** | Add IT ops report keys later |
| Notifications / Documents | **Already Implemented** | Optional challan storage in documents |

---

## 5. Future scope (explicit)

| Item | Reason |
|------|--------|
| Mobile agent auto-sync | Out of CR-004; discovery paste sufficient for now |
| Procurement auto-receive | Separate module |
| Full CMDB sync | Integration phase |
| Multi-currency IT chargeback | Finance scope |

---

## 6. Reuse vs never duplicate

| Reuse | Never duplicate |
|-------|-----------------|
| `ast_asset` register | Second employee register table |
| `ast_asset_assignment` | Shadow “issued assets” sheet |
| `ast_asset_component` | Separate charger inventory table |
| `discovery_profile_json` | Copy CPU/RAM into custom columns |
| Disposal workflow | Ad-hoc “delete row” for dead assets |
| Branch master | Per-branch duplicate location tables |
