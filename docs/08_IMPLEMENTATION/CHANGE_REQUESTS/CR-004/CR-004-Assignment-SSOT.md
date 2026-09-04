# CR-004 — Assignment Single Source of Truth

**Phase:** 1 — Documentation only

---

## Customer Excel fields → system ownership

| Excel field | Owner module / entity | Storage | Derived? |
|-------------|----------------------|---------|----------|
| Employee ID | Master Data — `master_employee` | `employee.employee_code` or id | No |
| Employee Name | Master Data | `master_employee` name fields | **Yes** (read) |
| Phone Number | Master Data | `master_employee` contact | **Yes** (read) |
| Laptop Name | Asset Register | `ast_asset.asset_name` | No |
| Asset Tag | Asset Register | `ast_asset.asset_code` / `barcode` | No |
| Brand | Master product / vendor | `product_id`, `supplier_vendor_id` | **Yes** (adapter) |
| Model | Master product / discovery | `product_id`, `discovery_profile_json.hardware` | **Yes** |
| Configuration | Discovery (CR-003) | `discovery_profile_json` | **Yes** (apply) |
| Charger | Components | `ast_asset_component` rows | No |
| Other Items | Components | `ast_asset_component` rows | No |
| Issue Date | Assignment | `ast_asset_assignment.allocated_at` | No |
| Location (branch) | Organization | `ast_asset.branch_id` | No |
| Location (desk/site) | Asset location / org | `ast_asset_location` or org `locations` | Partial |
| Earlier Used By | Assignment history | Prior `ast_asset_assignment` rows | **Yes** (query) |
| Delivery Challan | Assignment / Documents | **Missing** — recommend assignment ref or `asset-documents` | No |
| Remarks | Assignment | **Missing** — recommend `remarks` on assignment | No |
| Custody (current) | Assignment (authority) | Active `ast_asset_assignment` | **Derived as Current Holder** — see D-014; `custodian_employee_id` is sync mirror only |

---

## Rules

1. **Never** store employee name/phone on `ast_asset` for IT register export — join at read time.
2. **Never** duplicate brand/model in assignment row — use portal/report composition.
3. **Configuration** authoritative source after onboarding: `discovery_profile_json` (optional product spec).
4. **Earlier used by**: report query `ORDER BY allocated_at DESC` skipping current active row.
5. **Current Holder (CR-004):** Never persist; derive from active employee assignment when `operational_status = ASSIGNED` (`CR-004-Decision-Log.md` D-014).

---

## Read model for “Employee Asset Register” report

Recommended composition service (read-only):

```text
AssetReportEngine or new ItAssetRegisterComposer
  ← AssetRepository (branch, ops status, codes)
  ← AssignmentRepository (active + history)
  ← MasterDataAdapter (employee, product)
  ← ComponentRepository (accessories)
```

No new persistence for the register grid.
