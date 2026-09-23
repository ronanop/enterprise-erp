# CR-004 — Workflow Analysis (Current vs Customer)

**Phase:** 1 — Documentation only

---

## 1. Current platform workflows (as implemented)

### 1.1 Asset registration

| Step | Layer | Behavior |
|------|--------|----------|
| Create draft | `AssetService` + `RegistrationValidator` | `ast_asset.status = draft`; branch/company scoped |
| Submit / approve / activate | `AssetEngine` | `draft → submitted → approved → active` |
| Cancel / reopen | `AssetEngine` | Draft cancel; rejected workflow reopen |
| Update (draft) | `AssetService.update` | Field guards; category, cost, custodian rules |
| Discovery apply | `AssetService.apply_discovery_profile` | Allowlisted JSON + serial only (CR-003) |

**Relevant fields:** `asset_code`, `asset_name`, `serial_number`, `barcode`, `branch_id`, `custodian_employee_id`, `department_id`, `discovery_profile_json`, finance fields.

**Not present:** IT operational status; explicit “ready to move” flag.

---

### 1.2 Assignment

| Step | Layer | Behavior |
|------|--------|----------|
| Create | `AssignmentService` | Document `AASN-*`; allocation types include `employee` |
| Workflow | Governance + optional WF | Submit → approve |
| Activate | `AssignmentService._activate_assignment` | Sets assignment `active`; updates asset `custodian_employee_id` (+ master mirror) |
| Return | `return_assignment` engine | `active → returned`; clears custodian when matched |
| List/filter | Repository | `branch_id`, `status`, `asset_id`, search |

**Maps to Excel “Assigned Assets”** when filter: operational view + `assignment.status = active` + employee allocation.

**Gap vs Excel:** No first-class “delivery challan” or assignment remarks in ORM; no operational status flip on activate/return.

---

### 1.3 Transfer

| Step | Layer | Behavior |
|------|--------|----------|
| Document lifecycle | `TransferService` + `AssetTransferEngine` | draft → completed |
| Complete | Updates asset `branch_id`, optional `custodian_employee_id` | Supports branch inventory moves |

**Maps to Excel:** Branch inventory corrections (Noida/Mumbai/Dubai) partially — branch on asset exists via `BranchMixin`.

---

### 1.4 Maintenance

| Step | Layer | Behavior |
|------|--------|----------|
| Work orders | `MaintenanceService` + engine | Scheduled/in progress/completed |
| Asset status | Validators reference `in_maintenance` on asset where applicable | Operational IT status not updated |

---

### 1.5 Disposal

| Step | Layer | Behavior |
|------|--------|----------|
| Disposal document | `DisposalService` + `AssetDisposalEngine` | draft → posted |
| Asset terminal | `AssetEngine.dispose` | `disposed` / `written_off` |

**Maps to Excel “Not Working”** only after process design links dead device → `PENDING_DISPOSAL` → disposal doc → `DISPOSED`.

---

### 1.6 Reports

| Step | Layer | Behavior |
|------|--------|----------|
| Live reports | `AssetReportService` + `AssetReportEngine` | Read-only aggregation |
| Keys | `AssetLiveReportKey` | inventory, allocation, transfers, disposal, etc. |
| Snapshots | `ast_asset_report` | Optional persisted reports |

**Gap:** No dedicated “IT ops dashboard” report key; inventory by branch can be derived from register + branch_id.

---

### 1.7 Discovery (CR-003)

| Step | Behavior |
|------|----------|
| Parse | No persist |
| Apply | `discovery_profile_json` + serial; audit `discovery_apply` |

**Maps to Excel:** Configuration, hostname, CPU/RAM, manufacturer/model (when pasted from agent).

---

### 1.8 Components (FP-ASSET-019)

| Step | Behavior |
|------|----------|
| CRUD | `AssetComponentService` + engine |
| Status | `active` / `replaced` / `disposed` |

**Maps to Excel:** Charger, Other Items as components on the same asset.

---

### 1.9 QR (CR-002)

| Step | Behavior |
|------|----------|
| UI | Dynamic QR to self-service URL |
| Storage | No QR image persistence |

---

### 1.10 Information Portal (CR-002)

| Step | Behavior |
|------|----------|
| Read model | Redacted DTO via `AssetInformationPortalService` |
| Enrichment | Category, manufacturer, model from adapters; assignments summary |

**Not in sidebar** by design; reached from asset context.

---

## 2. Customer Excel workflow (target)

```text
Receive / register device
    → Ready To Move (branch stock)
    → Assign to employee (issue date, challan, remarks)
    → Assigned (in use)
    → Return → Ready To Move OR Retired OR Pending Disposal
    → Disposal posted → Disposed
```

Parallel dimension: **Branch** (Noida, Mumbai, Dubai) on every stock/assign view.

---

## 3. Mapping summary

| Excel sheet / bucket | Current system | Gap |
|----------------------|----------------|-----|
| Employee register | Register + assignments + portal | Unified IT ops view; challan/remarks |
| Ready To Move | No dedicated status | Operational status + filters |
| Assigned | Active assignments + custodian | Operational `ASSIGNED` sync |
| Not Given To Anyone | No equivalent | `RETIRED` operational status |
| Not Working | Maintenance/disposal ad hoc | `PENDING_DISPOSAL` + disposal link |
| Branch inventory | `branch_id` on assets | KPIs + filtered workspaces |

---

## 4. What must NOT be duplicated

| Data | Owner |
|------|--------|
| Employee ID, name, phone | `master_employee` |
| Branch | `organization.org_branch` |
| Department / location (org) | Organization masters |
| Brand/model (catalog) | `master_product` / vendor |
| Hardware snapshot | `discovery_profile_json` |
| Custody truth | `ast_asset_assignment` (active) + `custodian_employee_id` denormalized on asset |
| Finance lifecycle | `ast_asset.status` + disposal/depreciation documents |
