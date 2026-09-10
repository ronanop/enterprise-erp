# Quality Management — Complete User Guide

**Audience:** Quality inspectors, supervisors, and new ERP users  
**App URL:** http://localhost:3000/quality  
**Login (demo):** seeded users + `DEMO_PASSWORD` from local `.env` (not published in docs).
**Official spec:** `docs/02_FRD/FRD-14-Quality-Management-Domain.md`

---

## Table of contents

1. [What Quality Management does](#1-what-quality-management-does)
2. [The full workflow — what moves to what](#2-the-full-workflow--what-moves-to-what)
3. [Before you start (one-time setup)](#3-before-you-start-one-time-setup)
4. [How to use it — step by step](#4-how-to-use-it--step-by-step)
5. [Screen-by-screen reference](#5-screen-by-screen-reference)
6. [Status & button cheat sheet](#6-status--button-cheat-sheet)
7. [Three end-to-end scenarios](#7-three-end-to-end-scenarios)
8. [Reports & dashboard](#8-reports--dashboard)
9. [Troubleshooting](#9-troubleshooting)
10. [Quick URL reference](#10-quick-url-reference)

---

## 1. What Quality Management does

Quality Management is the ERP’s **quality control department**. It tracks:

- Whether **purchased material** is good enough to use (Incoming / IQC)
- Whether **production** is making good parts at each step (In-Process / IPQC)
- Whether **finished goods** are ready for the warehouse (Final / FQC)
- What happens when something **fails** — defects, NCRs, CAPAs, complaints, audits, and supplier scorecards

**Simple analogy:** Factory QC lab + complaint desk + audit team — all in one module.

---

## 2. The full workflow — what moves to what

Read this section first. It shows how records **flow** from one area to the next across the ERP.

### 2.1 Where Quality sits in the ERP

```
┌─────────────────┐
│  PROCUREMENT    │  Goods arrive (GRN / receipt)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  QUALITY (IQC)  │  Incoming Inspection — accept / reject material
└────────┬────────┘
         │  (only accepted material continues)
         ▼
┌─────────────────┐
│ MANUFACTURING   │  Production order / work order runs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ QUALITY (IPQC)  │  In-Process Inspection — check during production
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ QUALITY (FQC)   │  Final Inspection — check finished product
└────────┬────────┘
         │  (approved goods only)
         ▼
┌─────────────────┐
│  INVENTORY      │  Stock released into warehouse
└────────┬────────┘
         │
         ▼ (if customer complains)
┌─────────────────┐
│ QUALITY         │  Complaint → NCR → CAPA
└─────────────────┘
```

| Direction | Module | What Quality receives / sends |
|-----------|--------|-------------------------------|
| **From Procurement** | GRN / receipt | Triggers IQC on incoming material |
| **From Manufacturing** | Production orders | Triggers IPQC and FQC |
| **To Inventory** | Stock | Only **approved** inspections release goods |
| **From Customers** | Complaints | Customer issues become quality complaints |

---

### 2.2 Quality module internal lifecycle (setup → operations → closure)

This is the **order of work inside the Quality module itself**:

```
PHASE 1 — SETUP (do once, or when products/processes change)
═══════════════════════════════════════════════════════════
  Sampling Plans  ──┐
  Defect Types    ──┼──►  Inspection Plans  ──►  Characteristics
                    │         (activate plan)
                    └──────────────────────────────┘

PHASE 2 — DAILY INSPECTIONS
═══════════════════════════════════════════════════════════
  Incoming (IQC)  ──►  In-Process (IPQC)  ──►  Final (FQC)
       │                      │                      │
       └──────────────────────┴──────────────────────┘
                              │
                    (if something fails)
                              ▼
PHASE 3 — PROBLEM MANAGEMENT
═══════════════════════════════════════════════════════════
  Defect logged  ──►  NCR raised  ──►  NCR approved  ──►  CAPA
                              │                              │
                              └──────── fix & prevent ───────┘

PHASE 4 — ASSURANCE & METRICS (parallel / periodic)
═══════════════════════════════════════════════════════════
  Complaints  ──►  NCR (optional)
  Audits      ──►  Start → Complete → Close
  Supplier Quality  ──►  Publish scorecard
  Quality Scores    ──►  Publish KPI period
  Reports           ──►  Export CSV for management
```

---

### 2.3 What triggers what (record links)

| When this happens… | …this is created or updated | Where to see it |
|--------------------|----------------------------|-----------------|
| Material arrives from supplier | **Incoming Inspection (IQC)** | Quality → Incoming |
| Production order is running | **In-Process Inspection (IPQC)** | Quality → In-Process |
| Product is finished | **Final Inspection (FQC)** | Quality → Final |
| Inspector finds a problem | **Defect** | Quality → Defects (or log from inspection detail) |
| Formal non-conformance needed | **NCR** | Quality → NCRs (or **Create NCR** from rejected inspection) |
| Root cause must be fixed | **CAPA** | Quality → CAPAs (or **Create CAPA** from NCR detail) |
| Customer reports issue | **Complaint** | Quality → Complaints → optional NCR |
| Vendor performance review | **Supplier Quality scorecard** | Quality → Supplier |
| Periodic KPI roll-up | **Quality Score** | Quality → Scores (via Masters group) |
| Management review | **Reports** | Quality → Reports |

---

### 2.4 Inspection result → next action

| Inspection result | Meaning | Typical next step |
|-------------------|---------|-------------------|
| **Accepted** | All good | Material/product moves forward; no NCR needed |
| **Conditional** | Partial accept / partial reject | **Approve disposition** → may log defects |
| **Rejected** | Failed | **Approve disposition** → **Create NCR** → optional CAPA |
| **Rework required** (FQC) | Must fix and re-inspect | Rework in manufacturing, then re-inspect |

---

### 2.5 Navigation map (how you move in the app)

```
Quality Dashboard (/quality)
    │
    ├── Workspace tabs (top nav)
    │     Overview | Plans | Incoming | In-Process | Final | Defects
    │     NCRs | CAPAs | Audits | Complaints | Supplier | Reports
    │
    ├── Click any KPI card ──────────► filtered list (e.g. Open NCRs)
    ├── Click pipeline stage ────────► Incoming / IPQC / FQC / NCR / CAPA list
    ├── Click recent inspection row ─► inspection detail (workflow buttons)
    ├── Click NCR watch row ─────────► NCR detail
    │
    └── List page → click any row ───► detail page with workflow actions
              └── **New** button ────► create form
```

> **Tip:** Almost every list row is clickable. Open the detail page to change status, save quantities, log defects, or create linked records.

---

## 3. Before you start (one-time setup)

Complete this **once** before running inspections.

### 3.1 Prerequisites outside Quality

| Data | Where to set up | Why Quality needs it |
|------|-----------------|----------------------|
| Company & Branch | Organization | Every quality record is scoped to company/branch |
| Warehouse | Organization / Inventory | IQC needs a receiving warehouse |
| Product & UOM | Master Data | Inspections are per product |
| Vendor | Master Data | Optional for IQC; required for supplier scorecards |
| Customer | Master Data | Required for complaints |
| Production order | Manufacturing | Required for IPQC create |

### 3.3 Hero MotoCorp demo dataset (removed)

Hero seed/teardown tooling and live catalog were removed (2026-09-09) for security prep. An archive may remain under `apps/api/scripts/demo_data/_archived/`. Do not re-seed against shared or production databases.

### 3.2 Quality Masters setup (recommended order)

| Step | Menu | Action | Result |
|------|------|--------|--------|
| 1 | **Quality → Sampling Plans → New** | Define sample size, accept/reject counts | Sampling rule for AQL-style checks |
| 2 | **Quality → Defect Types → New** | Add defect names (scratch, dimension, etc.) | Used when logging defects |
| 3 | **Quality → Plans → New** | Name plan, pick inspection type (incoming/in-process/final) | Draft inspection plan |
| 4 | Open plan detail → **Activate plan** | Plan must be **active** before use | Plan ready for inspections |
| 5 | **Add characteristic** (from plan detail) or **Characteristics → New** | Link characteristic to plan; set target/min/max | Checklist items for inspections |
| 6 | (Optional) **Scores → New** | Open a KPI scoring period | For periodic FPY / defect rate publishing |

---

## 4. How to use it — step by step

### 4.1 Daily start — open the dashboard

1. Log in → sidebar → **Quality** (or go to `/quality`)
2. Review KPI cards:
   - **Open inspections** — work still in draft/in progress
   - **Open NCRs** — non-conformances needing attention
   - **Open CAPAs** — corrective actions in flight
   - **Critical defects** — highest-severity problems
3. Check **Recent inspections** and **NCR watch** — click any row to open detail
4. Use **Refresh** if you expect new data from colleagues

---

### 4.2 Incoming Inspection (IQC) — full procedure

**When:** Material arrives from a supplier (after procurement receipt).

#### Step A — Create IQC

1. Go to **Quality → Incoming** (or dashboard **New IQC**)
2. Click **New**
3. Fill required fields:
   - Company, Branch, Warehouse, Product, UOM
   - **Inspection Plan** (recommended — loads checklist)
   - Document date
   - **Inspected / Accepted / Rejected** quantities
4. If a plan is selected, fill at least **one checklist row** (measured value or pass/fail)
5. Click **Save draft**

> Quantity errors appear **above the input field** (not at page top). Rules: all qty ≥ 0; Accepted + Rejected ≤ Inspected.

#### Step B — Complete inspection (detail page)

After create you land on the inspection detail page.

1. Verify status = `draft`, result = `pending`
2. (Optional) Edit quantities → **Save quantities**
3. Click **Complete**
   - Result is calculated from quantities:

| Inspected | Accepted | Rejected | Result after Complete |
|-----------|----------|----------|------------------------|
| 10 | 10 | 0 | `accepted` |
| 10 | 8 | 2 | `conditional` |
| 10 | 0 | 10 | `rejected` |

4. If result is **not** `accepted` → click **Approve disposition**

#### Step C — If material failed

1. On rejected inspection → click **Create NCR** (pre-filled from inspection)
2. Or: **Defect Logging** section → select defect type → **Log defect**
3. Continue to [§4.5 NCR procedure](#45-ncr-non-conformance-report--full-procedure)

---

### 4.3 In-Process Inspection (IPQC) — full procedure

**When:** Production is running; you check quality at a work-order step.

1. **Quality → In-Process → New**
2. Fill: Company, Branch, **Production order**, Product, optional Inspection plan
3. Click **Create** → opens detail page
4. Click **Complete** when inspection is done
5. If defects found → **Log defect** on detail page

---

### 4.4 Final Inspection (FQC) — full procedure

**When:** Finished product is ready; gate before inventory.

1. **Quality → Final → New**
2. Fill required fields → **Create**
3. On detail page, run workflow in order:
   - **Submit**
   - **Approve**
   - **Release to inventory** (Complete)
4. If rejected → **Create NCR** or log defects

**FQC status flow:**
```
draft → submitted → approved → completed (inventory release)
```

---

### 4.5 NCR (Non-Conformance Report) — full procedure

**When:** Formal record needed for a quality failure.

#### Create NCR

| Method | Steps |
|--------|-------|
| From rejected inspection | IQC detail → **Create NCR** |
| Manual | **Quality → NCRs → New** |
| From complaint | Complaint detail → **Raise NCR** |

#### Process NCR

1. Open NCR detail (click row in list or NCR watch on dashboard)
2. **Submit NCR** → status `submitted`
3. **Approve** → status `approved`
4. **Close NCR** → status `closed`
5. Click **Create CAPA** to start corrective action

**NCR status flow:**
```
draft → submitted → approved → closed
```

---

### 4.6 CAPA — full procedure

**When:** Root cause must be fixed and prevented from recurring.

1. From NCR detail → **Create CAPA**  
   *(or Quality → CAPAs → New, linked to an NCR)*
2. On CAPA detail, run workflow:
   - **Submit CAPA**
   - **Approve**
   - **Verify**
   - **Close CAPA**

**CAPA status flow:**
```
draft → submitted → approved → in_progress → verified → closed
```

---

### 4.7 Defects

Defects are usually logged **from an inspection detail page**:

1. Open IQC / IPQC / FQC detail
2. **Defect Logging** → select **Defect type** → **Log defect**
3. View all defects: **Quality → Defects** → click row for detail
4. On defect detail → link to existing NCR (enter NCR ID → **Link NCR**)

---

### 4.8 Customer complaints

1. **Quality → Complaints → New**
2. Fill company, branch, customer, type, quantity, description
3. On complaint detail:
   - **Start investigation**
   - **Raise NCR** (if not already linked)
   - **Close complaint** when resolved

---

### 4.9 Quality audits

1. **Quality → Audits → New**
2. Set company, branch, audit type (internal / supplier / process), planned dates
3. On audit detail:
   - **Start audit**
   - **Complete audit**
   - **Close audit**

---

### 4.10 Supplier quality scorecards

1. **Quality → Supplier → New**
2. Select vendor, period start/end, optional accept rate and defect rate
3. On scorecard detail → **Publish scorecard** when ready

---

### 4.11 Inspection plans (masters)

1. **Quality → Plans → New** → create plan
2. Open plan → **Activate plan** (required before use)
3. **Add characteristic** or create characteristics linked to this plan
4. **Start IQC with this plan** — opens IQC create with plan pre-selected

---

## 5. Screen-by-screen reference

### Dashboard (`/quality`)

| Area | What it shows | Action |
|------|---------------|--------|
| KPI cards | Open inspections, NCRs, CAPAs, critical defects | Click → go to list |
| Pipeline funnel | Counts per stage | Click stage → open list |
| Quick links | Incoming, NCRs, CAPAs, Audits, Reports | Direct navigation |
| Workspace groups | Masters, Inspections, Assurance | Links to all sub-menus |
| Recent inspections | Latest IQC/IPQC/FQC | **Click row → detail** |
| NCR watch | Highest severity NCRs | **Click row → NCR detail** |
| Defect severity mix | Critical / major / minor | Click → Defects list |

### Top navigation tabs

| Tab | Purpose |
|-----|---------|
| Overview | Dashboard |
| Plans | Inspection plan masters |
| Incoming | IQC list + create |
| In-Process | IPQC list + create |
| Final | FQC list + create |
| Defects | All defect records |
| NCRs | Non-conformance reports |
| CAPAs | Corrective actions |
| Audits | Quality audits |
| Complaints | Customer complaints |
| Supplier | Vendor scorecards |
| Reports | KPI summaries + CSV export |

### Detail page actions (by record type)

| Record | Workflow buttons | Other actions |
|--------|------------------|---------------|
| IQC | Complete → Approve disposition | Save quantities, Log defect, Create NCR |
| IPQC | Complete | Log defect |
| FQC | Submit → Approve → Release to inventory | Log defect, Create NCR |
| NCR | Submit → Approve → Close | Create CAPA |
| CAPA | Submit → Approve → Verify → Close | — |
| Complaint | Start investigation → Close | Raise NCR |
| Audit | Start → Complete → Close | — |
| Supplier score | Publish scorecard | — |
| Inspection plan | Activate plan | Start IQC, Add characteristic |
| Quality score | Publish score | — |

---

## 6. Status & button cheat sheet

### Incoming inspection (IQC)

```
Status:  draft / in_progress  →  [Complete]  →  completed
Result:  pending  →  accepted | conditional | rejected
If result ≠ accepted:  [Approve disposition]
If result = rejected:  [Create NCR]
```

### Final inspection (FQC)

```
draft  →  [Submit]  →  submitted
submitted  →  [Approve]  →  approved
approved  →  [Release to inventory]  →  completed
```

### Quantity validation rules

- All quantities must be **≥ 0**
- **Accepted + Rejected ≤ Inspected**
- Errors show **above the input field** (red text + red border)

---

## 7. Three end-to-end scenarios

### Scenario A — Happy path (material fully accepted)

| # | Action | Expected result |
|---|--------|-----------------|
| 1 | Plans → create & **Activate** plan with characteristics | Active plan ready |
| 2 | Incoming → **New** → select plan, qty 10/10/0, fill checklist | IQC created |
| 3 | Detail → **Complete** | Result = `accepted` |
| 4 | Dashboard → pipeline count updates | Incoming count +1 |
| 5 | Reports → inspection summary | Row appears; click → detail |

### Scenario B — Conditional accept (partial reject)

| # | Action | Expected result |
|---|--------|-----------------|
| 1 | Create IQC with qty 10 / 8 / 2 | Draft inspection |
| 2 | **Complete** | Result = `conditional` |
| 3 | **Approve disposition** | Disposition approved |
| 4 | **Log defect** | Defect in Defects list |

### Scenario C — Full rejection → NCR → CAPA

| # | Action | Expected result |
|---|--------|-----------------|
| 1 | Create IQC with qty 10 / 0 / 10 | Draft inspection |
| 2 | **Complete** → **Approve disposition** | Result = `rejected` |
| 3 | **Create NCR** | NCR draft opened |
| 4 | NCR: Submit → Approve → Close | NCR closed |
| 5 | **Create CAPA** from NCR | CAPA draft |
| 6 | CAPA: Submit → Approve → Verify → Close | CAPA closed |

---

## 8. Reports & dashboard

### Reports page (`/quality/reports`)

| Report | Contents | Click row |
|--------|----------|-----------|
| Inspection summary | Incoming + final inspections | Opens inspection detail |
| Defect summary | All defects | Opens defect detail |
| NCR summary | All NCRs | Opens NCR detail |
| CAPA summary | All CAPAs | Opens CAPA detail |
| KPI dashboard | Aggregate counts | Not clickable (summary only) |

Each report section has **Export CSV** for management downloads.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Red error above qty field | Accepted + rejected > inspected | Lower accepted/rejected or raise inspected |
| **Complete** does nothing / fails | No checklist lines at create | Recreate IQC with plan + at least one checklist row |
| No **Approve disposition** | Result is `accepted` | Expected — not needed for full accept |
| No **Create NCR** button | Result is not `rejected` | Use NCRs → New manually for conditional cases |
| Row click does nothing | Old browser cache | Hard refresh (Ctrl+F5) |
| Empty dropdowns on create | Missing master data | Add company, product, warehouse, UOM in Organization / Master Data |
| Permission denied | User lacks quality permissions | Log in as admin or request `quality.*` permissions |
| Cannot edit checklist after create | By design | Checklist is set at create time — recreate IQC if wrong |
| 500 on create | Invalid quantities sent to API | Fix inline field errors before submitting |

---

## 10. Quick URL reference

| Task | URL |
|------|-----|
| Dashboard | `/quality` |
| New IQC | `/quality/incoming-inspections/new` |
| New IPQC | `/quality/inprocess-inspections/new` |
| New FQC | `/quality/final-inspections/new` |
| New plan | `/quality/plans/new` |
| New NCR | `/quality/ncrs/new` |
| New CAPA | `/quality/capas/new` |
| New complaint | `/quality/complaints/new` |
| New audit | `/quality/audits/new` |
| New supplier scorecard | `/quality/supplier-quality/new` |
| Reports | `/quality/reports` |
| API docs | http://localhost:8000/docs (search "Quality") |

---

## Terminology quick reference

| Term | Meaning |
|------|---------|
| **IQC** | Incoming Quality Control — check purchased material |
| **IPQC** | In-Process Quality Control — check during production |
| **FQC** | Final Quality Control — check finished goods |
| **NCR** | Non-Conformance Report — formal failure record |
| **CAPA** | Corrective And Preventive Action — fix root cause |
| **Disposition** | Decision to accept, reject, or conditionally accept |
| **FPY** | First Pass Yield — % good first time |
| **AQL** | Acceptable Quality Level — sampling standard |

---

## Verification checklist (copy & use)

**Setup**
- [ ] Sampling plan created
- [ ] Defect types created
- [ ] Inspection plan created and **activated**
- [ ] Characteristics linked to plan

**IQC**
- [ ] IQC created with plan + checklist
- [ ] Quantities valid (inline errors clear)
- [ ] **Complete** succeeds
- [ ] **Approve disposition** works when needed

**Problem chain (optional)**
- [ ] Defect logged
- [ ] NCR: Submit → Approve → Close
- [ ] CAPA: Submit → Approve → Verify → Close

**Reporting**
- [ ] Dashboard pipeline updated
- [ ] Reports load; CSV exports
- [ ] Report rows open correct detail pages

---

*Last updated: Full user guide — workflow overview (what moves to what), step-by-step procedures for all quality areas, navigation map, scenarios A/B/C, inline validation notes, and current UI capabilities.*
