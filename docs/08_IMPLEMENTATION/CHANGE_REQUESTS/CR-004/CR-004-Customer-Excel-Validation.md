# CR-004 — Customer Excel Template Validation

**Phase:** 8A.5 — Analysis only (no code, no UI, no backend, no import)  
**Date:** 2026-08-05  
**Purpose:** Compare the **customer Excel register contract** with the **Phase 8A Import Foundation** before Phase 8B Import Engine.

---

## Source materials

| Input | Used as |
|-------|---------|
| Customer Excel template(s) | **Logical template** reconstructed from CR-004 docs (see §0) |
| Phase 8A Import Foundation | `excel-import.types.ts` / mapper / validator / service |
| Business Validation Report | `CR-004-Business-Validation-Report.md` |
| Excel Migration Plan | `CR-004-Excel-Migration-Plan.md` |
| Supporting | Phase 1 Business Analysis, Phase 4.1 Gap Analysis, Inventory Views, Register Parity |

### 0. Binary workbook status

| Check | Result |
|-------|--------|
| `.xlsx` / `.xls` customer file in `enterprise-erp` repo | **Not found** |
| Checked docs / fixtures / CR-004 folder | No attached workbook |

**Implication:** This phase validates against the **locked customer Excel contract** documented across CR-004 (the same contract IT and engineering have been implementing against).  

**Gate for Phase 8B:** Customer must still supply a **frozen production export** (file hash + date) for a dry-run pass on real cell values, merged regions, and formulas. Until then, treat findings below as **contract mismatches**, not measured cell samples.

---

## 1. Workbook Summary

### 1.1 Expected customer workbook shape (from Phase 1 / 4.1)

| Aspect | Customer Excel (documented) | Phase 8A Import Foundation |
|--------|----------------------------|----------------------------|
| Primary artifact | **Employee Asset Register** (one row per laptop) | One parsed sheet → row grid |
| Bucket organization | Separate **tabs** *or* filters: Ready To Move, Assigned, Not Given To Anyone, Not Working (+ Disposed / Branch views) | **First sheet only**; ops status must be a **column** (or aliased header) |
| Branch dimension | Noida / Mumbai / Dubai filters / columns | Branch **column** validated against `/branches` labels |
| Active sheet | Register or current bucket tab | Always `SheetNames[0]` |
| Hidden sheets | Possible (archives, pivots) | Ignored |
| Merged cells | Common in Excel headers / title rows | **Not detected**; SheetJS flattens — risk of shifted headers |
| Formulas | Possible (counts, lookups) | Parsed as **cached values** if present; formulas themselves not executed |
| Multi-sheet import | Historical / branch sheets optional | **Out of scope** (8A) — only first sheet |

### 1.2 Verdict — workbook structure

| Finding | Severity | Notes |
|---------|----------|-------|
| Multi-tab buckets vs first-sheet-only parser | **Critical** | Real customer files often store status **by tab name**, not a Status column |
| No merged-cell / title-row detection | **High** | Title rows above headers will poison mapping |
| No formula audit | **Medium** | Prefer “values only” export from customer |
| No hidden-sheet scan | **Low** | Documented; archive sheets skipped |

---

## 2. Column Mapping Matrix

Legend: **Match** exact/alias · **Partial** name drift · **Gap** missing in 8A · **Skip** correctly excluded · **Extra** ERP-only field

| # | Customer Excel column (contract) | 8A target field | Mapping status | Notes |
|---|----------------------------------|-----------------|----------------|-------|
| 1 | Asset Tag | `assetTag` | **Match** | Required; aliases include `asset_code` |
| 2 | Laptop Name | `laptopName` | **Match** | Required |
| 3 | Branch / Location (branch) | `branch` | **Match** | Required; location also separate field |
| 4 | Ready/Assigned/… (tab or Status) | `operationalStatus` | **Partial** | Aliases include tab names (*Not Working*, *Not Given To Anyone*); **fails if status only implied by sheet name** |
| 5 | Employee ID | `employeeId` | **Match** | Optional; required-by-rule when ASSIGNED is only a **warning** in 8A (Migration Plan = **Error**) |
| 6 | Employee Name | — | **Gap / Skip** | Derived from master; should **not** import as SSOT |
| 7 | Phone Number | — | **Gap** | Not in 8A targets; employee master only |
| 8 | Manufacturer / Brand | `manufacturer` | **Match** | Optional |
| 9 | Model | `model` | **Match** | Optional |
| 10 | Configuration / CPU / RAM | `configuration` | **Partial** | Single field; separate CPU/RAM columns need concat rule |
| 11 | Charger | — | **Gap** | Components path; Migration Plan: optional parse — **not in 8A** |
| 12 | Other Items | — | **Gap** | Same as charger |
| 13 | Issue Date | `issueDate` | **Match** | Date parser present |
| 14 | Earlier Used By | — | **Skip (correct)** | Must **not** import; recompute from history |
| 15 | Current Holder | — | **Skip (correct)** | Derived when ASSIGNED |
| 16 | Delivery Challan | `deliveryReference` | **Partial** | Aliases include “delivery challan”; ERP stores `delivery_reference_number` |
| 17 | Remarks (issue) | `assignmentRemarks` | **Partial** | Alias `remarks`; **Return Remarks** not mapped for import |
| 18 | Return Remarks | — | **Gap** | Exists in register/export parity; **absent from 8A import targets** |
| 19 | Serial | — | **Gap** | Migration Plan includes serial → `serial_number` |
| 20 | Department | `department` | **Extra / optional** | May not exist on customer grid |
| 21 | Asset Category | `category` | **Extra / optional** | ERP-centric; may be blank in Excel |
| 22 | Delivery Status | `deliveryStatus` | **Extra** | ERP enrichment; unlikely in legacy Excel |
| 23 | Lifecycle Status | `lifecycleStatus` | **Extra** | Finance lifecycle; not IT Excel bucket |
| 24 | Location (desk/site) | `location` | **Partial** | Often same as Branch in Excel |

### 2.1 Exact matches (ready for auto-map)

Asset Tag · Laptop Name · Branch · Employee ID · Manufacturer · Model · Issue Date · Operational Status (when present as column)

### 2.2 Aliases already covered

- Ops: Ready To Move, Assigned, Retired, Not Given To Anyone → RETIRED, Not Working → PENDING_DISPOSAL, Disposed  
- Delivery challan → `deliveryReference`  
- Brand → manufacturer  

### 2.3 Unsupported / unmapped customer columns

| Column | Risk if ignored |
|--------|-----------------|
| Charger / Other Items | Accessories lost on cutover unless Phase 8B component parse |
| Serial | Identity / warranty matching weak |
| Phone / Employee Name | OK to ignore if Employee ID present |
| Separate CPU / RAM | Config incomplete unless concatenated |
| Return Remarks | Historical return notes not loaded |

### 2.4 Missing ERP-side import fields vs Migration Plan

| Migration Plan field | In 8A? |
|----------------------|--------|
| Serial | **No** |
| Charger / Other Items | **No** |
| Discovery CPU/RAM allowlist keys | **No** (only free-text configuration) |
| Earlier Used By | Correctly **excluded** |

---

## 3. Validation Findings

### 3.1 Data types

| Field | Customer Excel typical | 8A handling | Finding |
|-------|------------------------|--------------|---------|
| Asset Tag | Text / alphanumeric | String, required | OK |
| Employee ID | Code (EMP-001) or name | Lookup by id / label / `(CODE)` | OK if codes in labels; **fail** if Excel uses bare names without code |
| Branch | Noida / Mumbai / Dubai | Exact/normalized label map | OK if org labels match; typos → error |
| Department | Free text / blank | Master lookup | False negatives if Excel uses informal names |
| Manufacturer / Model | Free text | Stored as mapped strings (preview only) | OK for 8A |
| Configuration | Free text or split CPU/RAM | Single string | **Needs concat rule** before 8B |
| Operational Status | Tab name or friendly label | Enum + aliases | OK **if column present** |
| Lifecycle | Rarely in IT Excel | Optional field | Extra; ignore if blank |
| Delivery Reference | Challan no. | String | OK |
| Remarks | Free text | → assignment remarks | Return remarks **not imported** |
| Dates | DD/MM/YYYY common (IN) | Parser prefers DD/MM when ambiguous | Residual MM/DD risk |
| Phone | On Excel row | **Not validated** | Gap |
| Location | Branch or desk | Optional string | May duplicate Branch |

### 3.2 Data quality (expected in real files)

| Issue | 8A coverage | Gap |
|-------|-------------|-----|
| Duplicate Asset Tags | **Yes** (error) | — |
| Blank rows | Skipped if fully empty | Title/spacer rows with partial junk still parse |
| Merged cells | **No** | High risk on header row |
| Unexpected values | Row validators | — |
| Whitespace / case | Normalize lookups | OK |
| Invalid dates | **Yes** | Future dates only Warning in Migration Plan — **not** in 8A |
| Invalid branch | **Yes** | — |
| Missing employees | **Yes** (error if ID present) | ASSIGNED w/o employee = **Warning** (should be Error per Migration Plan) |

### 3.3 Business rules

| Excel concept | ERP / 8A | Finding |
|---------------|----------|---------|
| Ready To Move | `READY_TO_MOVE` | Alias OK |
| Assigned | `ASSIGNED` + employee | Warning-only without employee — **policy mismatch** |
| Retired / Not Given To Anyone | `RETIRED` | Alias OK |
| Pending Disposal / Not Working | `PENDING_DISPOSAL` | Alias OK |
| Disposed | `DISPOSED` | Alias OK; lifecycle align deferred to 8B |
| Earlier Used By | Do not import | **Correct** in 8A |
| Current Holder | Derived | **Correct** skip |
| Delivery Reference | Mapped | Name alias OK |
| Assignment Remarks | Mapped | OK |
| Return Remarks | Not in import targets | **Gap** for historical returns |

---

## 4. Required Mapping Adjustments

Before Import Engine (8B), adjust foundation / process as follows:

| ID | Adjustment | Priority |
|----|------------|----------|
| M-1 | Support **sheet-name → operational status** when Status column absent (map each tab separately or inject synthetic column) | **Critical** |
| M-2 | Detect / skip **title rows** and merged header blocks (require contiguous header row) | **Critical** |
| M-3 | Add **Serial** to import targets | **High** |
| M-4 | Add optional **Charger** / **Other Items** (text → component parse in 8B) | **High** |
| M-5 | Add aliases / concat for **CPU**, **RAM**, **OS** → `configuration` / discovery allowlist | **High** |
| M-6 | Promote ASSIGNED without Employee ID from Warning → **Error** (align Migration Plan) | **High** |
| M-7 | Add **Return Remarks** as optional mapped field (store only on historical return path in 8B) | **Medium** |
| M-8 | Add alias **Delivery Challan** as primary label in UI mapping list (already aliased) | **Low** |
| M-9 | Document customer export SOP: **values-only**, unmerge headers, one sheet or Status column | **Critical (process)** |
| M-10 | Obtain frozen real workbook; re-run 8A.5 with measured sheet counts / samples | **Critical (process)** |

---

## 5. Import Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Status only on tab names | Entire sheet mis-validated or rejected | High | M-1 + multi-pass import |
| Merged title rows | Wrong headers → mass empty_mandatory | High | M-2 + customer SOP |
| Branch label drift (e.g. “Noida HO”) | False invalid_branch | Medium | Alias table / fuzzy map with human confirm |
| Employee names without codes | invalid_employee mass failures | High | Pre-load EMP codes; mapping worksheet |
| Losing charger/serial | Incomplete ERP register vs Excel | High | M-3 / M-4 before cutover |
| Dual remarks (issue vs return) | Wrong field landing | Medium | M-7 + clear column guide |
| Large multi-sheet file | Only first sheet imported | High | Explicit sheet picker in 8B |
| Re-import of Earlier Used By as free text | Ownership violation | Medium | Keep skip; educate customer |
| DD/MM vs MM/DD | Wrong issue dates | Medium | Require ISO in template; warn on ambiguous |

---

## 6. Recommended Changes Before Import Engine

### Must-have (block 8B commit)

1. **Customer freeze kit:** real `.xlsx`, hash, date, sheet inventory, sample 20 rows signed off.  
2. **Sheet strategy:** either (a) Status column on a single consolidated sheet, or (b) importer iterates bucket tabs with injected ops status.  
3. **Header hygiene:** reject files whose row-1 is not a complete header (detect merged / title).  
4. **Policy align:** ASSIGNED without Employee ID = **Error**.  
5. **Add Serial (+ accessories text fields)** to mapping targets even if 8B parse is deferred.

### Should-have

6. CPU/RAM concat → configuration / discovery.  
7. Return Remarks optional mapping.  
8. Future-date warning on Issue Date.  
9. Branch alias dictionary for Noida/Mumbai/Dubai variants.

### Explicit non-goals (remain correct)

- Do **not** import Earlier Used By or Current Holder as writable columns.  
- Do **not** store Phone on asset/assignment.  
- Do **not** treat Lifecycle as IT bucket (keep separate).

---

## 7. Summary scorecard

| Area | Score | Comment |
|------|-------|---------|
| Column coverage vs documented Excel | **~70%** | Core identity + custody OK; serial/accessories/phone gaps |
| Bucket / status semantics | **~60%** | Aliases good; **tab-based status unsupported** |
| Data quality validators | **~80%** | Strong on duplicates/masters; weak on structure |
| Business rule alignment vs Migration Plan | **~75%** | Employee-on-ASSIGNED severity mismatch |
| Ready for Import Engine? | **NO-GO** until M-1, M-2, M-9, M-10 cleared |

---

## 8. References

- `CR-004-Phase-1-Business-Analysis.md`
- `CR-004-Phase-4.1-Excel-Gap-Analysis.md`
- `CR-004-Excel-Migration-Plan.md`
- `CR-004-Inventory-Views.md`
- `CR-004-Business-Validation-Report.md`
- `CR-004-Phase-8A-Excel-Import-Foundation.md`
- `apps/web/src/components/assets/excel-import/excel-import.types.ts`

---

## Document control

| Item | Value |
|------|-------|
| Mode | Analysis only |
| Code changes | None |
| Next phase | 8B Import Engine — only after Critical items in §4 / §6 |
