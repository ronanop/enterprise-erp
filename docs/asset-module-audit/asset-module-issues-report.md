# Asset Management Module — Issues Report

**Generated:** 2026-08-25  
**Companion:** `asset-module-analysis-report.md` (factual inventory)  
**Method:** Static review of current source. Live browser/API was **not** re-run in this pass. Where a root cause is inferred, that is stated.  
**Out of scope:** Rewriting the module. This is diagnosis + a fix plan.

---

## 1. Broken Functionality

### 1.1 Configuration → Locations is a dead screen

| | |
|---|---|
| **Supposed to happen** | Users pick / manage cities and buildings used by registration, inventory, transfers, and reports (`AssetLocationsPlaceholderWorkspace` copy). |
| **Actually happens** | Route `/assets/locations` renders a “coming in Phase R1” card. No list, no CRUD, no API. Add Asset instead writes a string `location_label` from hardcoded `ASSET_SITE_CATALOG` (`config/asset-site-catalog.ts`). |
| **Likely root cause** | Product explicitly deferred Asset Location Master. UI still ships a sidebar item that looks like a real workspace. File: `apps/web/src/components/assets/asset-locations-placeholder-workspace.tsx` lines 8–38. |
| **Suggested fix** | Either (A) implement Location Master and wire Add Asset / inventory filters to it, or (B) hide the nav item until R1 and send users to a documented interim (site catalog or org locations). Do not leave a full nav entry that only explains it is unimplemented. |
| **Severity** | **Major** (sidebar promises a capability that does not exist). |

### 1.2 Asset Types is not a type master

| | |
|---|---|
| **Supposed to happen** | Sidebar “Asset Types” reads as a maintainable catalog. |
| **Actually happens** | `AssetTypesWorkspace` maps `ASSET_PRD_TYPES` in-memory. Description in-file: *“UI-only until a dedicated API is available.”* Backend `asset_type` is a 4-value check constraint (`fixed/consumable/digital/leased`), not the PRD type names (Laptop, Desktop, …). |
| **Likely root cause** | PRD types are a frontend overlay (`config/asset-prd-types.ts`) mapped onto `apiAssetType`. File: `apps/web/src/components/assets/asset-types-workspace.tsx`. |
| **Suggested fix** | Short term: label the page “Type catalog (read-only)” and remove implied edit. Medium: persist types (or category attributes) in API so Add Asset and inventory filters share one source of truth. |
| **Severity** | **Major** (operators cannot add types; naming disagrees with DB). |

### 1.3 Settings page does not persist anything

| | |
|---|---|
| **Supposed to happen** | `modules.ts` resource `settings`: “Asset module preferences.” |
| **Actually happens** | Static markdown-like cards pointing at env flag `ASSET_WORKFLOW_GOVERNANCE_ENABLED` and a seed-permissions command. File: `asset-settings-workspace.tsx`. Not in locked sidebar (hidden), still routed. |
| **Suggested fix** | Remove the route or replace with real tenant settings; do not document CLI in the product UI. |
| **Severity** | **Minor** (hidden from rail) / **Major** if linked from dashboard later. |

### 1.4 Dashboard notification and profile buttons do nothing

| | |
|---|---|
| **Supposed to happen** | Header actions for notifications / user (inferred from `aria-label`). |
| **Actually happens** | Icon `Button`s with no `onClick`. Labels: `"Notifications (placeholder)"`, `"Profile (placeholder)"`. Covered by tests that **assert the placeholders exist** (`asset-operations-dashboard.test.tsx` ~75–78). File: `asset-operations-dashboard.tsx` ~188–205. |
| **Suggested fix** | Remove the buttons, or wire Bell to `/assets/asset-notifications` (or Foundation inbox) and User to the app profile menu. Update the test that currently locks in dead controls. |
| **Severity** | **Minor** (visual chrome) but looks unfinished on the primary landing page. |

### 1.5 Celery “alerts” do not alert

| | |
|---|---|
| **Supposed to happen** | ERD/FRD-style maintenance due, warranty/insurance expiry, audit reminders, finance retry. |
| **Actually happens** | Tasks count rows (or list document numbers) and return JSON. No `NotificationService.send`, no email. Depreciation scheduler skips without tenant/company/user UUIDs; never calculates/posts. File: `apps/api/src/modules/asset/tasks.py`. |
| **Suggested fix** | Either implement send via existing `ast_asset_notification` + Foundation templates, or rename tasks/docs so ops do not expect overnight emails. Wire beat only after send exists. |
| **Severity** | **Major** if production depends on scheduled alerts; otherwise documentation gap. |

### 1.6 Excel import is implemented but unreachable from the product nav

| | |
|---|---|
| **Supposed to happen** | Operators bulk-load the register (`POST /api/v1/assets/assets/import`, UI `/assets/inventory-import`). |
| **Actually happens** | Page and API exist. Locked sidebar has no item. Inventory toolbar is **export-only** (`inventory-export-toolbar.tsx`). No `href` to `/assets/inventory-import` in `components/assets`. Operators must know the URL. |
| **Suggested fix** | Add “Import” next to inventory export and/or a sidebar item under Assets. |
| **Severity** | **Major** (feature exists, operators will not find it). |

### 1.7 Add Asset auto-approve can fail under workflow governance / SOD

| | |
|---|---|
| **Supposed to happen** | One “Add Asset” click yields an **active** / READY_TO_MOVE asset (happy path in `asset-add-form.tsx` `submit()`). |
| **Actually happens** | Client chains `create` → `submit` → `approve`. If `ASSET_WORKFLOW_GOVERNANCE_ENABLED` and SOD forbids the same user to approve, the form shows amber “activation incomplete” and asks to retry. That is handled, but the primary CTA still implies one-shot activation. |
| **Likely root cause** | UI assumes maker-checker is off. Inference: depends on env; not reproduced in this pass. |
| **Suggested fix** | If governance is on, stop after submit and show “Awaiting approval.” If off, keep the chain. Branch on a small settings/info endpoint rather than catching 422. |
| **Severity** | **Major** in governed tenants; **Minor** if flag is always off in the target deploy. |

### 1.8 Transfer create — historical production bug (code now looks fixed)

| | |
|---|---|
| **Supposed to happen** | `POST /asset-transfers` creates a draft. |
| **Actually happened (2026-08-09 E2E)** | HTTP 500 `TypeError` duplicate `asset_id` (`docs/ASSET_MANAGEMENT_E2E_VERIFICATION_REPORT.md` BUG-TRF-CREATE-01). |
| **Current code** | `transfer_service.py` `create()` strips `asset_id` from `**fields` before `self._repo.create(..., asset_id=asset.id, **payload)` (lines 107–119). |
| **Suggested fix** | Re-run the transfer create E2E. Do not treat as open unless it fails again. |
| **Severity** | **Unclear / previously blocker.** Infer **closed in source**; confirm at runtime. |

### 1.9 Disposal POST to Finance depends on an open period

| | |
|---|---|
| **Supposed to happen** | Approve then post disposal → DISPOSED + journal. |
| **Actually happens** | Historical E2E: create/submit/approve OK; **post blocked** when only FY period open was Apr-2025. Root cause is Finance period, not Asset UI. `finance_port.py` still requires `branch_id` and posts SYSTEM journals. |
| **Suggested fix** | Surface a clear API/UI error (“No open fiscal period”) and deep-link to Finance periods. Optional: disable Post when period check fails client-side. |
| **Severity** | **Major** in mis-dated environments; not an Asset-only code defect. |

### 1.10 Documents are URI records, not uploads

| | |
|---|---|
| **Supposed to happen** | “Documents” in Extended nav implies attaching files. |
| **Actually happens** | Forms collect URL/URI and hex digest (`asset-document-workspace.tsx`). No multipart upload. |
| **Suggested fix** | Rename to “Document links” or integrate the Document module storage API. |
| **Severity** | **Minor** if operators know it is metadata; **Major** if they expect file attach. |

### 1.11 QR / Barcode has no scanner

| | |
|---|---|
| **Supposed to happen** | Nav copy: “Generate **and scan** asset labels” (`modules.ts` qr-barcode). |
| **Actually happens** | Search register + `QRCodeCanvas` + print (`asset-qr-workspace.tsx`). No camera / barcode decode. |
| **Suggested fix** | Change copy to “Generate labels”, or add a scan path (camera + lookup by code). |
| **Severity** | **Minor** (generate works) / **Major** if warehouse scan was in scope. |

### 1.12 Return wizard does not validate before Confirm

| | |
|---|---|
| **Supposed to happen** | Condition + component outcomes complete before POST return. |
| **Actually happens** | `validateReturnStep` always returns `null` (`wizard-validation.ts` 39–43). Footer `onNext` / `onFinish` do not block. Backend **will** 422 if issued components exist and `component_returns` is missing — user sees that only after the last step. |
| **Suggested fix** | Mirror backend rules on the client: require a condition; require an outcome per issued component. |
| **Severity** | **Major** (late errors; extra Next clicks). |

### 1.13 Meter readings cannot be edited; service history cannot be updated

| | |
|---|---|
| **Supposed to happen** | Typical CRUD. Permissions include `asset.meter:update`. |
| **Actually happens** | Meters: create + void only (no PATCH). Service history: create + list only. |
| **Suggested fix** | Align UI copy (“recorded / void”) or add PATCH if product requires corrections. |
| **Severity** | **Minor**. |

### 1.14 Category list pagination is not a DB page

| | |
|---|---|
| **What happens** | `list_asset_categories` loads all matching rows then slices (`routers/__init__.py` ~194–198). Fine at small N; will degrade. |
| **Suggested fix** | Use repository `search` with offset/limit like other aggregates. |
| **Severity** | **Minor** until category count grows. |

---

## 2. Broken / Inconsistent UI

| Screen | What’s wrong | File | Suggested fix |
|---|---|---|---|
| All `/assets/*` | **Two (often three) scrollbars**: document/`<main>` grows with content; module rail has its own `overflow-y-auto`; when not standalone, `AppSidebar` is a third `h-dvh` scroller. | `assets-module-sidebar.tsx` 52–56; `layout.tsx`; `app-shell.tsx`; `app-sidebar.tsx` 46–82 | See §3. |
| Module sidebar (desktop) | Icon-only 64px rail; labels only on hover. Hover expand overlays content (`absolute` + `z-20`) which is intentional, but **19 items × 5 groups** still overflow the `max-h` and force an inner scrollbar. | `assets-module-sidebar.tsx` | Reduce groups, collapse groups, or use a single viewport scroller (§3). |
| Module sidebar (mobile) | Full nav stacked **above** the page (`lg:hidden`). User scrolls the page **and** a tall nav. | same | Convert to a sheet/drawer or compact select. |
| Dashboard | Extra inner padding `px-1 py-2` on top of `AppShell` main padding; Bell/User dead controls; “Asset Operations” vs module title “Asset Management”. | `asset-operations-dashboard.tsx` 175–184 | Drop nested padding; remove placeholders; align naming. |
| Dashboard vs sidebar | Cards/pipeline still advertise Depreciation, Audits, etc. that the locked rail hides. | `config/assets.ts` `assetsWorkspaceGroups`, `assetsPipelineStages`, `assetsQuickLinks` | Align cards with `assetManagementNav` or restore those items to the rail. |
| Add Asset location | “Location” / “Building” are a **static catalog**, not `/assets/locations` and not org locations. | `asset-add-form.tsx` + `asset-site-catalog.ts` | After Location Master, bind selects to API. Until then, label “Site (catalog)”. |
| Disposal / depreciation / revaluation post | Debit/credit/fiscal year as raw UUID placeholders `xxxxxxxx-xxxx-…`. | `asset-disposal-workspace.tsx` ~870+ (same pattern on dep/rev) | Account pickers from Finance, not paste-UUID. |
| Service history create | `parts_replaced_json` as a JSON textarea with example `[{"part":"filter","qty":1}]`. | `asset-service-history-workspace.tsx` ~690 | Structured line editor. |
| Documents | URL + checksum fields. | `asset-document-workspace.tsx` | See §1.10. |
| QR print | `window.open` + `document.write(<img>)` — fragile with popup blockers; no print CSS for label size. | `asset-qr-workspace.tsx` `printLabel` | Dedicated print stylesheet / `window.print` on a label layout. |
| Assignment wizard steps | `EmployeeStep` / `AssetStep` / `IssuedItemsStep` default to **demo names** (`Priya Sharma`, `LT-2024-014`) if props omitted. Container usually passes real lists; Story/miswire risk. | `wizard-mock-data.ts`; step default params | Remove production defaults; require props or empty state. |
| Icon reuse | `UserCheck` for Departments **and** Asset Assignment. | `config/assets.ts` | Distinct icons (e.g. `Building2` vs `UserCheck`). |
| Unused tab nav | `AssetsWorkspaceNav` unused; would show Depreciation/Audits contrary to locked rail. | `assets-workspace-nav.tsx` | Delete or reuse after aligning items. |
| Generic workspaces | Dense list+form pages (maintenance, insurance, …) use the same ad-hoc filter row; not the inventory `InventoryFilterBar` pattern. Feels like a second product. | `asset-*-workspace.tsx` | Share filter/toolbar primitives; keep density but match inventory typography/spacing. |
| Finance UUID + JSON | Breaks “Swiss / data-dense admin” vs rest of ERP pickers. | several workspaces | Use the same combobox pattern as org/employee selects. |

**Responsive:** Inventory table `min-w` + `overflow-x-auto` is present in dashboard branch breakdown (`min-w-[520px]`). Inventory main table relies on page overflow. At 375px, stacked sidebar + filters + wide table will require horizontal scroll — expected for density, but the **module sidebar on mobile** consumes a large first-screen budget before the table.

---

## 3. Sidebar UI Problems (deep-dive)

### 3.1 Which sidebar is “the asset sidebar”?

The module-specific one is **`AssetsModuleSidebar`**:

- `apps/web/src/components/assets/assets-module-sidebar.tsx`
- Mounted in `apps/web/src/app/(app)/assets/layout.tsx` (all `/assets/*` routes).

It is **in addition to** the global `AppSidebar` (`apps/web/src/components/layout/app-sidebar.tsx`) whenever the tab is **not** standalone (`useStandaloneChrome()` false).

CRM/Projects in standalone mode swap the primary sidebar. Assets standalone still renders `AssetsModuleSidebar` and **hides** `AppSidebar`.

### 3.2 Why there is an internal scrollbar **and** a page scrollbar

**Observed layout (desktop, not standalone):**

1. **`AppSidebar`**  
   `sticky top-0 h-dvh flex-col` + inner `<nav className="… flex-1 overflow-y-auto">`.  
   This is a viewport-tall column with **its own** scroll. It does not scroll the document.

2. **Main column** (`AppShell`)  
   `min-h-dvh` flex column. `<main>` is `flex-1` with **no** `overflow-hidden` / `min-h-0` / `overflow-y-auto`.  
   Content height = header + asset page. The **document/body** (or the flex column) grows past `100dvh` → **page/body scrollbar**.

3. **`AssetsModuleSidebar` desktop rail**  
   ```tsx
   className="… max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain"
   ```
   (`assets-module-sidebar.tsx` lines 52–56)  
   Parent: `lg:sticky lg:top-4 lg:self-start` (`layout.tsx` uses `lg:items-start`, so the aside does not stretch to main height).  
   Nav groups (~19 links + 5 uppercase headers + dividers) exceed `100dvh - 5.5rem` → **second scrollbar on the rail**.

4. **Page content** (inventory table, dashboard cards) is taller than the viewport → **third scrollbar** (the window).

`layout.tsx`:

```tsx
<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
  <AssetsModuleSidebar />
  <div className="min-w-0 flex-1">{children}</div>
</div>
```

`lg:items-start` prevents the sidebar from sharing the main column height. Combined with `max-h` + `overflow-y-auto` on the rail, the rail **must** scroll independently of the page.

**Mobile:** the full-label nav is **in document flow** (not `max-h`). It lengthens the page. Only the window scrolls — unless some child also overflows.

### 3.3 Exact fix (pick one scroller)

**Recommended for this ERP (data-dense, inventory is the long surface):**

- **Window/`<main>` scrolls the page content only.**
- **Asset module sidebar does not scroll internally** if the item list can be shortened; **or** it is a **viewport-locked column** that is the **only** scroller for nav, while `<main>` is the only scroller for content.

**Concrete CSS/layout change:**

1. **Lock the app content column to the viewport** (same idea as `AppSidebar`’s `h-dvh`):

   In `app-shell.tsx`, for assets (or globally):

   - Outer: `h-dvh overflow-hidden` (already `min-h-dvh`; change to **`h-dvh overflow-hidden`**).
   - Main: `flex-1 min-h-0 overflow-y-auto` (this is **the** page scroll container).
   - Keep `AppSidebar` as `h-dvh overflow-hidden` with **one** inner `overflow-y-auto` (already the case).

2. **Make the asset rail fill the main column and scroll only inside the rail, without growing the document:**

   - `assets/layout.tsx`: `lg:items-stretch` (not `items-start`); wrapper `lg:min-h-0 lg:h-full` or `lg:h-[calc(100dvh-<topbar>)]`.
   - `AssetsModuleSidebar` aside: `lg:h-full lg:max-h-none lg:sticky lg:top-0` **or** drop sticky entirely inside a locked main.
   - Rail nav: `h-full overflow-y-auto` **xor** `overflow-visible` if the list is shortened enough to fit.

3. **Do not use both** `max-h-[calc(100dvh-5.5rem)] overflow-y-auto` on the rail **and** an unconstrained growing `<main>`. That pairing is what creates **nested** scrollbars.

**If product wants the sidebar to never scroll:** collapse groups (accordion), drop duplicate items, or use a compact icon rail **without** expanding to 19 labels in-column (flyout menu per group). Then remove `overflow-y-auto` from the rail.

### 3.4 Other sidebar issues

| Issue | Detail |
|---|---|
| Information density | 5 sections, 19 destinations. Hover-to-expand hides labels until mouseover — high memory load for new users. |
| Active state | Implemented (`aria-current`, primary tint). Add Asset vs All Assets special-case is correct. Issue/return wizard URLs under `/assets/asset-assignments/*` will prefix-match **Asset Assignment** (OK). |
| Grouping | Locked “current scope” omits depreciation/audits while dashboard still promotes them — hierarchy is inconsistent. |
| Icon consistency | Duplicate `UserCheck`; Lucide otherwise fine. |
| Responsiveness | Mobile full list is too tall; no hamburger. Desktop overlay rail can cover the first columns of the inventory table on hover (`z-20`). |
| Dual chrome | App sidebar + module sidebar is unique vs modules that only use `AppSidebar`. Standalone tab removes app sidebar (good) but operators in a non-standalone tab get **triple** scroll. |

---

## 4. Multi-Step Wizard Feature (deep-dive)

### 4.1 What uses a wizard?

**A. Issue asset (assignment)** — primary product wizard  

- Entry: `/assets/asset-assignments/new`  
- Components: `AssignmentWizard` + `AssignmentWizardContainer`  
- Stepper: `WizardStepper` / `WizardProgressBar` (`wizard-stepper.tsx`)  
- Step ids: `ASSIGNMENT_WIZARD_STEPS` in `wizard-types.ts`

**B. Return asset** — second 5-step wizard  

- Entry: `/assets/asset-assignments/return`  
- `ReturnWizard` + `ReturnWizardContainer`  
- `RETURN_WIZARD_STEPS`

**C. Excel import** — third stepper (pipeline, not the assignment UX)  

- `/assets/inventory-import`  
- Steps: `select` → `parse` → `template` → `mapping` → `validate` → `preview` (`excel-import.types.ts`)

Add Asset is **already** a single scrolling page with sections (not a stepper). Do not convert it back to steps.

There is also a **non-wizard** assignment create form on `AssetAssignmentWorkspace` (list page). Two UIs for the same API.

### 4.2 Issue wizard — current steps

| # | id | Fields / actions |
|---|---|---|
| 0 | `employee` | `allocationType` (employee/department/project/branch/warehouse), employee **or** department **or** project id, `expectedReturnAt` |
| 1 | `asset` | `assetId` from READY_TO_MOVE list; unavailable-asset empty state |
| 2 | `issued-items` | Multi-select `issuedItemIds` (components). Optional. Empty → “Register components first.” |
| 3 | `delivery` | DC number, DC status (pending/issued/received), signature (not_signed/signed), remarks |
| 4 | `review` | Read-only summary; Finish → save/submit/activate via container |

Per-step validation (`validateAssignmentStep`): employee/dept/project required by type; asset required; issued items **not** required; DC number required if status is issued/received; review has no extra checks.

**Real sequential dependencies**

- Issued items **must** load after `assetId` (container `onAssetChange` / `listComponents`).  
- Delivery does **not** depend on accessories.  
- Review depends on all previous fields.

Allocation type → which party field shows is **conditional**, not a reason for a separate page.

### 4.3 Return wizard — current steps

| # | id | Fields / actions |
|---|---|---|
| 0 | `summary` | Read-only asset/assignment snapshot |
| 1 | `condition` | `returnCondition`: good / outdated / dead (drives ops: READY / RETIRED / PENDING_DISPOSAL) |
| 2 | `components` | Per-line outcome RETURNED/MISSING/DAMAGED/RETAINED + remarks |
| 3 | `remarks` | `returnRemarks`, `reason` |
| 4 | `review` | Confirm return |

`validateReturnStep` is a no-op. Next is always allowed.

**Dependencies:** Component lines come from the assignment; condition is independent but should be visible next to outcomes (dead/outdated changes asset fate).

### 4.4 Proposed single-page (non-stepped) redesign

**Issue asset — one scrollable page, three cards:**

1. **Custody** — allocation type + employee/dept/project (conditional reveal) + expected return + asset picker (filter READY_TO_MOVE). When asset changes, accessory checklist **appears below** (same page).  
2. **Delivery challan** — DC number/status/signature + remarks.  
3. **Review strip** (optional sticky footer) — summary + Save draft + Submit.

No Next. Issued items stay **disabled/hidden until an asset is selected** (preserve the only hard dependency).

**Return asset — one page:**

- Summary header (read-only).  
- Condition radios.  
- Component table (hidden if no issued lines).  
- Remarks.  
- Single **Confirm return**.

**Excel import:** Do **not** flatten parse/validate into fake form sections. Collapse **machine steps** (`parse`, `template`, `validate`) into spinners on the same page: **(1) file + mapping (2) preview + Import**. Keep sequential **processing**, drop six numbered chips.

### 4.5 Validation / UX implications

- Replace `tryNext` with **inline** field errors (same pattern as `AssetAddForm` `fieldErrors`).  
- Single submit: run today’s finish-loop (`validateAssignmentStep` for all indices) once.  
- Return: add real client validation before POST.  
- Wizard stepper/progress bar can be deleted or reduced to a right-rail **section nav** (`scrollIntoView`) without hiding fields.  
- `WizardFooter` Back/Next goes away; keep Save draft + primary Submit.  
- Accessibility: one `h1`, section `h2`s, no step `aria-current` on hidden panels.  
- Do not keep mock employee/asset defaults on the single page.

---

## 5. General Professionalism / Usability Gaps

- **Two products in one module:** Inventory/dashboard (PRD, filters, drawer) vs generic `asset-*-workspace` list/forms (UUID paste, JSON, duplicated filter rows).  
- **Nav vs IA drift:** Locked rail vs `assetsWorkspaceGroups` vs unused `AssetsWorkspaceNav` vs orphan import route.  
- **Typography/spacing:** Dashboard nested `px-1`; workspaces use mixed `space-y-4` vs `space-y-6`; page titles “IT Asset Inventory” vs “Asset Operations” vs module “Asset Management”.  
- **Empty / loading / error:** Inventory and many workspaces have `EmptyState`, skeletons, and error+retry. Dashboard has KPI empty and queue error slots. Locations/Settings have **no** empty/error (static). Wizard has load banner + step skeleton.  
- **CTAs:** Add Asset primary is clear. Dashboard Bell is not. Disposal “Post” appears without explaining Finance period/accounts.  
- **Hardcoded site catalog** vs placeholder Location Master trains users that location is a free-form label.  
- **Hover-only rail labels** fail pointer-less / tablet use (focus-within helps keyboard only).  
- **Tests freeze placeholders** (dashboard Bell/User) so professionalism issues are now “spec”.  
- **No multi-select bulk** on inventory despite ERP expectations (assign/export selected).

---

## 6. Prioritized Fix List

Ordered by severity, then effort (quick wins first within a tier).

| Issue | Type | File(s) | Severity | Suggested fix | Effort |
|---|---|---|---|---|---|
| Nested page + module-rail scrollbars | UI | `assets-module-sidebar.tsx`, `assets/layout.tsx`, `app-shell.tsx` | Major | Viewport-lock shell; one scroller for main; rail `h-full overflow-y-auto` **or** shorten nav and drop inner overflow | S–M |
| Locations nav is a placeholder | UX | `asset-locations-placeholder-workspace.tsx`, `config/assets.ts` | Major | Hide nav or ship Location Master and bind Add Asset | S (hide) / L (build) |
| Excel import orphaned | UX | `inventory-export-toolbar.tsx`, `config/assets.ts`, `inventory-import/page.tsx` | Major | Add Import action + optional nav item | S |
| Issue + return 5-step wizards | UX | `assignment-wizard/*`, `wizard-types.ts`, `wizard-validation.ts` | Major | Single-page sections; keep conditional accessories; real return validation | M |
| Return wizard no client validation | Bug | `wizard-validation.ts`, `return-wizard.tsx` | Major | Enforce condition + component outcomes | S |
| Asset Types not maintainable / name mismatch | UX | `asset-types-workspace.tsx`, `asset-prd-types.ts` | Major | Relabel read-only; later persist types | S / L |
| Dashboard vs rail IA mismatch | UX | `config/assets.ts` (`assetsWorkspaceGroups`, pipeline, quick links) | Major | Align cards with locked nav | S |
| Celery alerts are counters | Bug | `modules/asset/tasks.py` | Major | Send via NotificationService or stop advertising alerts | M |
| Add Asset create+approve vs SOD | Bug | `asset-add-form.tsx` `submit()` | Major | Branch on governance; don’t auto-approve when flag on | M |
| Disposal/dep/rev Post UUID fields | UX | `asset-*-workspace.tsx` (disposal, depreciation, revaluation) | Major | Finance account/period pickers | M |
| Dead Bell/User on dashboard | UX | `asset-operations-dashboard.tsx`, `*.test.tsx` | Minor | Remove or wire; update tests | S |
| Duplicate `UserCheck` icons | UI | `config/assets.ts` | Minor | Distinct Lucide icons | S |
| Documents = URI not files | UX | `asset-document-workspace.tsx` | Minor | Rename or integrate Document module | S / L |
| QR “scan” copy vs generate-only | UX | `modules.ts`, `asset-qr-workspace.tsx` | Minor | Fix copy or add scan | S / M |
| Mock wizard defaults | Bug | `wizard-mock-data.ts`, `*-step.tsx` | Minor | Empty states only; no demo people | S |
| Unused `AssetsWorkspaceNav` | UI | `assets-workspace-nav.tsx` | Minor | Delete | S |
| Category list in-memory page | Bug | `routers/__init__.py` `list_asset_categories` | Minor | DB offset/limit | S |
| Settings dead route | UX | `asset-settings-workspace.tsx` | Minor | Remove from `modules.ts` or implement | S |
| Mobile module nav too tall | UI | `assets-module-sidebar.tsx` | Minor | Sheet / accordion | M |
| Service history JSON textarea | UX | `asset-service-history-workspace.tsx` | Minor | Line items UI | M |
| Transfer create 500 (historical) | Bug | `transfer_service.py` | Unclear | Re-run E2E; code looks fixed | S (verify) |
| Finance period blocks disposal post | Bug | Finance + `finance_port.py` | Major (env) | Clear error + period UX | M |
| Meter/history no update | UX | routers + workspaces | Minor | Copy or PATCH | S |
| Inventory no bulk actions | UX | `asset-inventory-workspace.tsx` | Minor | Multi-select + export/assign | L |

---

## Suggested implementation order (follow-up prompts)

1. **Scrollbar + layout lock** (shell + assets layout + rail overflow) — no product debate.  
2. **Issue/return wizards → single page** (highest daily-path UX).  
3. **Nav honesty:** hide Locations or build it; add Import; align dashboard cards; delete dead nav component.  
4. **Dashboard placeholders and icon duplication.**  
5. Finance pickers / governance-aware Add Asset / Celery as separate backend tickets.

Do not combine (1) and (2) in one PR if review bandwidth is limited; they touch overlapping layout but different user flows.
