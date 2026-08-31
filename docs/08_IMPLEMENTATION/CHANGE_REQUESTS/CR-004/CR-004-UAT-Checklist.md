# CR-004 — UAT Checklist

**Date:** 2026-08-05  
**Purpose:** Business / IT Admin acceptance tests for CR-004  
**Environment:** Staging with seed employees, branches (e.g. Noida/Mumbai), and Ready assets  

Use: `[ ]` pending · `[x]` pass · `[F]` fail · `N/A`

---

## A. Prerequisites

| # | Step | Result |
|---|------|--------|
| A1 | User signed in with asset assign/return/dispose permissions | `[ ]` |
| A2 | At least one branch with Ready To Move assets | `[ ]` |
| A3 | Employee master has active employees | `[ ]` |
| A4 | Backend migrations through assignment enrichment applied | `[ ]` |

---

## B. Asset Registration

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| B1 | Register / activate IT asset | Asset active; ops `READY_TO_MOVE` | `[ ]` |
| B2 | Asset shows correct branch | Branch filter finds asset | `[ ]` |
| B3 | Ops status not editable via generic asset PATCH | Rejected / unchanged | `[ ]` |

---

## C. Inventory

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| C1 | Open inventory | List loads | `[ ]` |
| C2 | Preset Ready To Move | Only READY assets | `[ ]` |
| C3 | Preset Assigned | Only ASSIGNED | `[ ]` |
| C4 | Preset Retired | Only RETIRED | `[ ]` |
| C5 | Preset Pending Disposal | Only PENDING_DISPOSAL | `[ ]` |
| C6 | Branch filter | Counts/list scoped | `[ ]` |
| C7 | Search by code/name | Filters rows | `[ ]` |
| C8 | Pagination | Page change works | `[ ]` |
| C9 | Open drawer | Summary + assignment sections | `[ ]` |
| C10 | Current Holder on assigned asset | Employee label shown | `[ ]` |
| C11 | Earlier Used By | **Known gap:** may show `—` until S1 | `[ ]` / `N/A` |
| C12 | Action: Assign | Navigates to Issue wizard with asset prefilled | `[ ]` |
| C13 | Action: Return | Navigates to Return wizard | `[ ]` |
| C14 | Drawer closes on Assign/Return | Drawer not left open | `[ ]` |

---

## D. Issue (Assignment) workflow

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| D1 | Open `/assets/asset-assignments/new` | Wizard loads | `[ ]` |
| D2 | Deep link `?assetId=` | Asset prefilled | `[ ]` |
| D3 | Deep link `?employeeId=` | Employee prefilled | `[ ]` |
| D4 | Select employee + asset + delivery + remarks | Validation allows Next | `[ ]` |
| D5 | Save draft | Draft persisted; can resume `?draftId=` | `[ ]` |
| D6 | Submit from review | Submit (+ activate if workflow allows) | `[ ]` |
| D7 | After success | Soft return to inventory; list refreshed | `[ ]` |
| D8 | Asset now Assigned; Current Holder set | Preset Assigned shows asset | `[ ]` |
| D9 | Delivery reference stored | Visible on assignment API / review | `[ ]` |
| D10 | Cancel wizard | Returns to inventory; no orphan required | `[ ]` |

---

## E. Return workflow

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| E1 | Return from Assigned asset | Return wizard opens with summary | `[ ]` |
| E2 | Condition **Good** | Ops → `READY_TO_MOVE`; appears in Ready preset | `[ ]` |
| E3 | Condition **Outdated** | Ops → `RETIRED`; Ready empty for that asset | `[ ]` |
| E4 | Condition **Dead** | Ops → `PENDING_DISPOSAL` | `[ ]` |
| E5 | Return remarks / reason | Persisted on assignment | `[ ]` |
| E6 | Success → inventory | Soft return; drawer closed; status updated | `[ ]` |
| E7 | Deep link `?assignmentId=` | Loads that assignment | `[ ]` |
| E8 | Missing assetId/assignmentId | Clear error; no crash | `[ ]` |

---

## F. Disposal

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| F1 | Asset in PENDING_DISPOSAL | Visible in preset / dashboard queue | `[ ]` |
| F2 | Post disposal document | Ops → `DISPOSED`; not assignable | `[ ]` |
| F3 | Cannot assign disposed asset | Blocked with clear error | `[ ]` |

---

## G. Dashboard

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| G1 | KPI cards show bucket counts | Numbers load | `[ ]` |
| G2 | Branch filter changes KPIs/queues | Scoped | `[ ]` |
| G3 | Ready / Pending Disposal queues | Clickable / listed | `[ ]` |
| G4 | After Issue/Return without leaving app | **Known gap:** may need revisit page | `[ ]` / `N/A` |

---

## H. Navigation & browser

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| H1 | Inventory → Issue → Success → Inventory | Filters/search/page restored | `[ ]` |
| H2 | Inventory → Return → Success → Inventory | Same | `[ ]` |
| H3 | Browser Back from wizard | No infinite loop / broken state | `[ ]` |
| H4 | Browser Refresh on Issue with `draftId` | Draft reloads | `[ ]` |
| H5 | Browser Refresh on Return with `assetId` | Return reloads | `[ ]` |
| H6 | No duplicate navigation on Assign click | Single navigation | `[ ]` |

---

## I. Negative / security

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| I1 | Assign when not Ready | Blocked | `[ ]` |
| I2 | Return when not active assignment | Error banner + Retry | `[ ]` |
| I3 | User without permission | Actions hidden / 403 | `[ ]` |
| I4 | Invalid `intent` on return URL | Page host error | `[ ]` |

---

## J. Excel parity (acceptance gate for Excel stop)

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| J1 | All five Excel buckets operable in ERP | Pass C2–C5, E2–E4, F2 | `[ ]` |
| J2 | Challan + remarks visible without API tools | **Gap until inventory wiring** | `[ ]` |
| J3 | Earlier Used By shows prior employee | **Gap until history derivation** | `[ ]` |
| J4 | Export register to Excel-like file | **Gap until Phase 7 report** | `[ ]` |
| J5 | Historical Excel rows imported | **Gap until Phase 7 import** | `[ ]` |

---

## UAT sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| IT Admin | | | Pilot GO / NO-GO |
| Business Owner | | | Excel stop GO / NO-GO |
| Engineering | | | Defects logged |

**Recommended:** Pilot GO only if B–I pass; Excel stop only if J1–J5 pass.
