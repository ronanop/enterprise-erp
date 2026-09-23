# CR-004 — Business Validation Report

**Date:** 2026-08-05  
**Mode:** Analysis only — no code changes  
**Scope:** Full CR-004 implementation vs customer Excel, architecture lock, and production use  
**Primary question:** *Can the customer stop using Excel today?*

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Can IT run **day-to-day** Ready / Assign / Return / Retire / Dispose **inside the ERP** for assets already on the platform? | **Mostly yes** — core workflows are implemented end-to-end |
| Can the customer **fully stop using Excel today** (including historical register, one-time cutover, and full column parity)? | **No** |

**Go / No-Go for Excel retirement:** **NO-GO** until Critical blockers below are cleared.  
**Go / No-Go for controlled pilot on new assets in ERP:** **CONDITIONAL GO** (pilot branch, parallel Excel for history).

---

## 1. Asset Registration — **PASS** (with notes)

| Check | Result | Evidence |
|-------|--------|----------|
| Registration workflow | PASS | Existing FP-ASSET / CR registration; wizards & APIs present |
| Lifecycle (`ast_asset.status`) | PASS | Separate from operational status (D-001) |
| Branch ownership | PASS | `branch_id` on asset; inventory/dashboard branch filters |
| Asset status vs ops status | PASS | Dual-field model locked and enforced |
| Default IT ops after activate | PASS | Backfill / engine → `READY_TO_MOVE` for active stock |

**Notes:** Registration UX is platform-native, not Excel-shaped. Acceptable for ERP; not a blocker for stopping Excel tabs once assets exist in system.

---

## 2. Inventory — **PASS** (partial Excel parity)

| Check | Result | Evidence |
|-------|--------|----------|
| Register / list | PASS | `AssetInventoryContainer` + ops list APIs |
| Search / filters / pagination | PASS | Filter bar + client/server query |
| Branch filter | PASS | Header branch + list query |
| Operational status presets | PASS | Ready / Assigned / Retired / Pending Disposal (+ All) |
| Drawer | PASS | Detail drawer + sections |
| Action menu | PASS | Assign / Return / Portal / etc. via AssetNavigation |
| Current Holder | PASS | Derived from active assignment (`inventory.mapper`) |
| Earlier Used By | **FAIL** | UI shows placeholder `"—"`; not derived from assignment history |

**Verdict:** Inventory **replaces Excel bucket tabs** for daily browsing. **Does not** yet replace the full Employee Asset Register row (earlier holder, live challan/remarks in drawer).

---

## 3. Assignment — **PASS**

| Check | Result | Evidence |
|-------|--------|----------|
| Issue workflow (wizard) | PASS | Issue wizard + container + frontend service |
| Draft / Submit / Activate | PASS | API + `submitDraft` / best-effort `activateAssignment` |
| Delivery Reference | PASS | Backend 5A + wizard Delivery step |
| Assignment Remarks | PASS | Backend + wizard; issued items encoded in remarks |
| Return + condition + remarks | PASS | Return wizard + `POST …/return` body |
| Ops status on activate/return | PASS | `AssignmentService` → `AssetOperationalStatusService` |

**Notes / residual risk:**

- Legacy `asset-assignment-workspace` modal still coexists with wizards (Medium — confusion risk).
- Multi-step workflow may leave status `submitted` if auto-approve fails (Medium — documented).
- Inventory soft-refresh after issue/return implemented; dashboard KPI auto-refresh deferred (Medium).

---

## 4. Return Workflow — **PASS**

| Excel outcome | System mapping | Result |
|---------------|----------------|--------|
| Good → Ready To Move | `good` → `return_to_ready` → `READY_TO_MOVE` | PASS |
| Outdated → Retired (“Not Given To Anyone”) | `outdated` → `retire` → `RETIRED` | PASS |
| Dead → Not Working / Pending Disposal | `dead` → `mark_pending_disposal` → `PENDING_DISPOSAL` | PASS |

**Evidence:** `assignment_return_condition.py`, Return wizard condition step, container → `returnAsset`.

---

## 5. Disposal — **PASS**

| Check | Result | Evidence |
|-------|--------|----------|
| Pending Disposal → Disposed | PASS | `DisposalService` calls operational status service on post |
| Inventory / dashboard visibility | PASS | Preset + dashboard pending-disposal queue |

**Notes:** Disposal UX is existing module (not CR-004 rebuild). Adequate for Excel “Disposed” bucket if IT uses disposal posting.

---

## 6. Dashboard — **PASS** (with deferred refresh)

| Check | Result | Evidence |
|-------|--------|----------|
| KPIs (ops buckets) | PASS | Phase 3.3B summary DTO + dashboard |
| Ready / Pending Disposal queues | PASS | Operations fetch + cards |
| Branch filter | PASS | Dashboard branch selector |
| Ops status awareness | PASS | Summary counts by ops status |
| Refresh after Issue/Return | **DEFERRED** | No shared cache; revisit dashboard to see updates |

---

## 7. Navigation — **PASS**

| Check | Result | Evidence |
|-------|--------|----------|
| Inventory → Issue → Inventory | PASS | AssetNavigation + AssignmentNavigation + stale/UI snapshot |
| Inventory → Return → Inventory | PASS | Same |
| Deep links (`assetId`, `draftId`, `assignmentId`, `intent`) | PASS | Page hosts + query mappers (Task 5) |
| Soft refresh (no full reload) | PASS | Session stale flag + UI snapshot (Task 6) |
| Browser back/forward | PASS* | Soft routes; *manual UAT still required in browser |

---

## 8. Operational Status — **PASS**

| Transition | Result |
|------------|--------|
| `READY_TO_MOVE` → `ASSIGNED` | PASS (activate) |
| `ASSIGNED` → `READY_TO_MOVE` | PASS (return good) |
| `ASSIGNED` → `RETIRED` | PASS (return outdated) |
| `ASSIGNED` → `PENDING_DISPOSAL` | PASS (return dead) |
| `PENDING_DISPOSAL` → `DISPOSED` | PASS (disposal post) |
| Engine sole writer / no direct PATCH | PASS (architecture lock) |

**Policy:** `RETIRED` → `READY_TO_MOVE` blocked by design (Excel “never give again”).

---

## 9. Excel Parity — **FAIL** (for full replacement)

| Excel concept | Status |
|---------------|--------|
| Ready To Move tab | **PASS** (inventory preset) |
| Assigned tab | **PASS** |
| Retired / Not Given To Anyone | **PASS** (`RETIRED`) |
| Pending Disposal / Not Working | **PASS** |
| Disposed | **PASS** (disposal + ops) |
| Employee Asset Register (full grid) | **PARTIAL** — missing Earlier Used By, live challan/remarks in register/drawer, Excel export |
| Branch Inventory | **PASS** (filters + dashboard) |
| Excel one-time import | **FAIL** — Phase 7 not started |
| Sidebar Excel-like filters | **FAIL** — Phase 3.5 not started (mitigated by inventory presets) |
| IT register report / export | **FAIL** — Phase 7 |

---

## 10. Data Ownership — **PASS** (with gaps)

| Concept | Ownership | Result |
|---------|-----------|--------|
| Current Holder | Derived (active assignment + ASSIGNED) | PASS |
| Employee | Master employee | PASS |
| Branch | Asset / assignment branch | PASS |
| Configuration | Discovery / product | PASS |
| Components | `ast_asset_component` | PASS (issued items via wizard/remarks) |
| Assignment | `ast_asset_assignment` SSOT | PASS |
| History | Assignment rows | PASS (backend); UI history panel incomplete |
| Earlier Used By | Should be derived history | **FAIL** (placeholder) |
| Delivery Reference | Assignment enrichment | PASS (backend/wizard); **inventory drawer still `"—"`** |
| Remarks | Assignment enrichment | PASS (backend/wizard); **inventory drawer still `"—"`** |

---

## Remaining issues (classified)

### Critical

| ID | Issue | Why critical |
|----|-------|--------------|
| C-1 | **No Excel import / cutover tooling** | Existing Excel register cannot be retired without migration |
| C-2 | **No IT Employee Asset Register export/report** | Auditors/IT still need Excel-equivalent dump for sign-off |

### High

| ID | Issue | Impact |
|----|-------|--------|
| H-1 | **Earlier Used By always `"—"`** | Excel column not usable in ERP |
| H-2 | **Inventory drawer challan/remarks not wired to live assignment** | Excel register fields invisible in daily register |
| H-3 | **Historical Excel data still authoritative until import** | Dual-source risk |

### Medium

| ID | Issue | Impact |
|----|-------|--------|
| M-1 | Dashboard KPI auto-refresh after Issue/Return deferred | Stale KPIs until revisit |
| M-2 | Legacy assignment workspace coexists with wizards | Wrong path / incomplete fields |
| M-3 | Activate may stop at `submitted` in multi-approver workflow | Issue not “Excel-instant” |
| M-4 | Sidebar polish (Phase 3.5) not done | Navigation density vs Excel tabs |
| M-5 | Component ↔ issued items matching by label on draft reload | Fragile accessory tracking |

### Low

| ID | Issue | Impact |
|----|-------|--------|
| L-1 | Focus-asset stash unused for UI highlight | Nice-to-have |
| L-2 | Operational timeline (post Phase 7) | Future |
| L-3 | Discovery read-only ops already OK | Non-blocker |

---

## Final scores

| Metric | Estimate | Rationale |
|--------|----------|-----------|
| **1. Overall Completion %** | **82%** | Phases 1–3 + assignment FE E2E done; import/export/sidebar/history gaps |
| **2. Production Readiness %** | **70%** | Pilot-ready for new ERP assets; not org-wide Excel cutover |
| **3. Excel Replacement Readiness %** | **55%** | Daily tabs/workflows ~yes; register parity + migration ~no |

### Critical blockers (must clear to stop Excel)

1. **C-1** Excel import / cutover plan executed  
2. **C-2** IT register export (or approved substitute report)  
3. **H-1 / H-2** Earlier Used By + challan/remarks visible on inventory register/drawer  

### Recommended Sprint Plan

| Sprint | Focus | Exit |
|--------|-------|------|
| **S1** | Wire Earlier Used By + delivery/remarks into inventory mapper/drawer; hide/deprecate legacy assignment return button path | Register column parity for live data |
| **S2** | IT Asset Register report/export (Excel-shaped columns) | C-2 cleared |
| **S3** | Phase 7 import dry-run on one branch; reconcile ops vs assignment | C-1 path proven |
| **S4** | Production import + parallel run (2 weeks); dashboard refresh event optional | Excel retirement candidate |
| **S5** | Sidebar polish + remove dual assignment UX | Hardening |

### Go / No-Go

| Decision | Recommendation |
|----------|----------------|
| **Full Excel stop (org-wide)** | **NO-GO** |
| **Pilot: one branch, new assets only, Excel retained for history** | **GO** (with training on Issue/Return wizards) |
| **Production ERP ops (without Excel retirement)** | **GO** for Ready/Assign/Return/Dispose paths already built |

---

## Answer to the mission question

> **Can the customer stop using Excel today?**

**No.** The ERP can now **operate** the Excel *buckets and issue/return outcomes* for assets already in the system, but it cannot yet **replace** the Excel register as the system of record for historical rows, earlier holders, or signed-off exports. Clear **C-1, C-2, H-1, H-2** before declaring Excel retired.
