# Quality module — presentation walkthrough

**Audience:** You, preparing a live demo  
**Story:** Demo Hero MotoCorp plant (Gurgaon) — a bought-out brake disc fails incoming inspection, then the vehicle is traced, warranted, and recalled  
**App:** http://localhost:3000  
**Login:** use your local `DEMO_PASSWORD` from `.env` (not stored in this guide).
**Company to select:** **DEMO-HMC** — Demo Hero MotoCorp Plant (Gurgaon)  
**VIN (say it out loud):** `MBLDEM00TEST00001`  
**Time:** ~12–15 minutes if you follow the script; ~8 minutes if you only do the core path (sections 4–6)

This is **not** the full user manual. The full guide is `01-Quality-Management-Guide.md`. This document is the **talk track + click path** using data already seeded for DEMO-HMC.

---

## 1. What to say in 60 seconds (elevator)

Quality in this ERP is the plant’s **QC / QA desk**. It does **not** own vendors, products, or production orders. It **inspects** what other modules send (or, in this demo, what we entered by hand).

Three inspection gates:

| Gate | Everyday name | Question it answers |
|------|----------------|---------------------|
| IQC | Incoming | Is the **supplier lot** good enough to use? |
| IPQC | In-process | Is the **line** making good parts at this step? |
| FQC | Final | Is the **finished vehicle / SKU** ready to ship? |

If something fails: **defect → NCR** (internal report) → optionally **SCAR** (ask the supplier to fix it) and **CAPA** (fix the process). Automotive extras already in this build: **PFMEA, PPAP, SPC, VIN trace, warranty, recall**.

Honest limitation for the room: **Procurement and Manufacturing are not driving this demo.** There is no live GRN or work order. We show Quality **as if** the lot and the vehicle already exist, using DEMO-prefixed masters (not live Hero part numbers).

---

## 2. How the workflow actually runs

```
SETUP (once)
  Sampling plan  →  Defect types  →  Inspection plans (must Activate)
  →  Characteristics (spec: OD 240 mm)  →  optional PFMEA

DAILY GATES
  Incoming (IQC)  →  In-process (IPQC)  →  Final (FQC)  →  VIN trace

FAIL PATH (this demo’s core)
  Measured OD out of spec  →  Defect  →  NCR  →  SCAR to supplier

FIELD PATH (after a vehicle is built)
  FQC approved  →  VIN  →  Warranty claim  →  Recall (VIN range)
```

**Status language you will see**

| Document | Typical statuses you click through |
|----------|-----------------------------------|
| Inspection plan | draft → **active** (required before use) |
| Incoming IQC | draft → **Complete** → result accepted / **conditional** / rejected → **Approve disposition** if not fully accepted |
| NCR | draft → submit → approve → close |
| SCAR | draft → **Issue** → record response → verify → close |
| PPAP | draft → **Submit** (then approve / reject / interim) |
| Final FQC | draft → submit → approve → complete |
| VIN | built → inspected → shipped |
| Warranty | draft → investigating → … → close |
| Recall | draft → **announced** / in progress → close |

Dashboard funnel (core): Incoming → In-process → Final → NCR → CAPA.  
Extra widgets (this demo): PPAP pipeline, SPC out-of-control, open SCARs, **active recalls** (red), PFMEA, recent warranty.

---

## 3. Before you start presenting (2 minutes, off-camera)

1. API and web are running. App: http://localhost:3000  
2. ~~Hero demo seed~~ — **removed** (2026-09-09). This walkthrough is historical; data is no longer in DB.  
3. Log in as admin.  
4. ~~Company dropdown / DEMO-HMC~~ — **removed** from the Workspace header (not shipping). Walkthrough data was wiped.  
5. Open **Quality** (`/quality`) and glance at the dashboard so widgets are not on first paint during the talk.  
6. Keep this cheat sheet next to you:

| Role in the story | Code | Name |
|-------------------|------|------|
| Company | DEMO-HMC | Demo Hero MotoCorp Plant (Gurgaon) |
| Branch | DEMO-GGN | Gurgaon demo branch |
| Warehouse | DEMO-WH-IQC | Incoming stores |
| Supplier | DEMO-V-BRAKE | Demo Brake Systems Ltd |
| Part | DEMO-P-DISC | Front brake disc 240 mm |
| Finished SKU | DEMO-P-SPL | Demo scooter Splendor-class |
| Engine | DEMO-P-ENG | Demo engine assembly |
| Dealer | DEMO-C-DLR | Demo dealership |
| Spec | DEMO-CHR-OD | OD target **240**, min **239.8**, max **240.2** mm |
| Lot (say it) | DEMO-LOT-8841 | On the IQC story |

Do **not** invent Bosch / official Hero part numbers on screen.

---

## 4. Presentation script — core use case (do this live)

**Story you tell:**  
*A lot of 100 front brake discs arrived from Demo Brake Systems. Incoming QC measured outer diameter. Three pieces are over 240.2 mm. We will not treat this as “just a scratch on a list.” We complete IQC, raise an NCR, and issue a SCAR to the supplier.*

Suggested timing: **6–8 minutes**.

### Step 0 — Set the scene (dashboard)

1. Click **Quality** in the sidebar (or `/quality`).  
2. Point at: open inspections, open NCRs, **open SCARs**, funnel Incoming → CAPA.  
3. Say: *“This is the QC supervisor’s home. We will now open the failed incoming lot.”*

### Step 1 — Masters exist (30 seconds, do not create)

You do **not** create plans live unless someone asks “where does the spec live?”

If asked, click in this order (Quality workspace / module lists):

1. **Sampling Plans** → `DEMO-SMP-AQL15` (sample 50, accept 1, reject 2, AQL 1.5%).  
2. **Defect Types** → `DEMO-DT-RUNOUT` (major), also porosity and scratch.  
3. **Inspection Plans** → `DEMO-QPL-IQC-DISC` — type **incoming**, status **active**.  
4. **Characteristics** → `DEMO-CHR-OD` — numeric, 239.8–240.2 mm.  
5. Optional: **PFMEA** → `DEMO-PFMEA-ENG` (engine line, RPN from S=8, O=3, D=4).

**Line to say:** *“The plan must be activated. Characteristics are the drawing spec. Quality does not store the vendor or the part — those are master data.”*

### Step 2 — Incoming inspection (the money screen)

1. Go to **Incoming** (`/quality/incoming-inspections`).  
2. Open **`DEMO-QM-IQC-0001`**.  
3. Walk the header out loud:

   - Warehouse: Incoming stores  
   - Vendor: Demo Brake Systems Ltd  
   - Product: Front brake disc 240 mm  
   - Qty: inspected **100**, accepted **97**, rejected **3**  
   - Lot: DEMO-LOT-8841 (in the line notes)

4. Open the **checklist line**: measured **240.5** vs max **240.2** → fail / out of spec, defect type runout.  
5. Point at **Complete** / **Approve disposition** if they are still available (seed already completed the lifecycle; if the document is already completed/conditional, say *“Complete sets the result from quantities: mix of accept and reject = conditional.”*).

**Line to say:** *“Accepted + rejected cannot exceed inspected. Conditional means some of the lot can still be used; rejected quantity is contained.”*

### Step 3 — Defect

1. **Defects** (`/quality/defects`) → **`DEMO-QM-DEF-0001`**.  
2. Severity **major**, qty **3**, linked to the incoming inspection and then to the NCR.

**Line to say:** *“A defect is the finding. An NCR is the formal non-conformance. They are separate on purpose.”*

### Step 4 — NCR

1. **NCRs** (`/quality/ncrs`) → **`DEMO-QM-NCR-0001`**.  
2. Source **incoming**, severity **major**, same vendor and disc.  
3. Mention buttons: Submit → Approve → Close (seed left this as a working document; if still draft, you can Submit once for theatre).

**Line to say:** *“NCR is internal. It does not automatically email the supplier. That is SCAR.”*

### Step 5 — SCAR (supplier)

1. **SCARs** (`/quality/scars`) → **`DEMO-QM-SCAR-0001`**.  
2. Issued to **DEMO-V-BRAKE**, linked NCR, then supplier response recorded, verified, closed (seed already ran that lifecycle).  
3. If status is **closed**, say *“Issue → supplier response → verify → close. Independent of the NCR state machine.”*

**Line to say:** *“SCAR is not a child of NCR. We can raise it because the vendor is at fault, even if CAPA is still empty.”*

Pause. Ask if anyone wants CAPA. **This demo did not seed a CAPA** — if they ask, say *“CAPA is the internal 5-why / action plan. We would create it from NCRs → New and link this NCR.”* Do not invent a CAPA on the fly unless you have time.

---

## 5. Presentation script — automotive extras (pick 1–2)

Use these if the audience is IATF / two-wheeler. Skip if time is short.

### A — PPAP (supplier part approval)

1. **PPAP** (`/quality/ppaps`) → **`DEMO-QM-PPAP-0001`**.  
2. Level **3**, same disc and brake vendor, control plan = incoming disc plan.  
3. Status should be **submitted** (pipeline on the dashboard).

**Line to say:** *“PPAP here is the approval header and workflow, not the full 18-element binder. No finance posting.”*

### B — Vehicle: Final QC + VIN + warranty

1. **Final** (`/quality/final-inspections`) → **`DEMO-QM-FQC-0001`** — finished scooter SKU, qty 1.  
   (Production order is a stub UUID because Manufacturing is not live.)  
2. **VIN Traces** (`/quality/vin-traces`) → **`DEMO-QM-VIN-0001`**.  
   - VIN: **`MBLDEM00TEST00001`**  
   - Component line: brake disc `DEMO-P-DISC`  
3. **Warranty Claims** (`/quality/warranty-claims`) → **`DEMO-QM-WRN-0001`**.  
   - Type **field_failure**, dealer **DEMO-C-DLR**, *front brake noise 800 km*.

**Line to say:** *“Warranty is not a customer complaint. It requires a VIN trace. We do not post a finance journal from this screen.”*

### C — Recall (dashboard red card)

1. **Recalls** (`/quality/recalls`) → **`DEMO-QM-RCL-0001`**.  
2. Status **announced** (counts as active).  
3. VIN range **`MBLDEM00TEST00001`** to **`MBLDEM00TEST00099`**.  
4. Reason: caliper bolt torque campaign (demo).  
5. Return to `/quality` and point at **active recalls**.

**Line to say:** *“This version stores a VIN range, not a child list of every VIN. Containment is the campaign; CAPA would still be the action plan if we linked one.”*

### D — SPC (process control)

1. Open reports or SPC readings list. Documents **`DEMO-QM-SPC-0001` … `0010`**.  
2. Values sit around 240.0; **`DEMO-QM-SPC-0010` is 241.00** — out of control.  
3. That reading auto-created an extra **NCR** (not `DEMO-QM-NCR-0001`).

**Line to say:** *“Cp/Cpk is calculated on the capability report. We do not persist a scorecard row from SPC in this build.”*

### E — In-process (only if they ask about the line)

1. **In-Process** → **`DEMO-QM-IPQC-0001`**, engine SKU, plan `DEMO-QPL-IPQC-ENG`.  
2. Say: *“UI normally picks a production order from Manufacturing. This record uses a placeholder UUID so we can demo without MFG.”*

---

## 6. Close on reports (1 minute)

1. **Reports** (`/quality/reports`).  
2. Mention: inspection / defect / NCR / CAPA / KPI (original), plus PPAP status, SCAR summary, SPC capability, warranty trend.  
3. Click **Export CSV** on one report if it is visible.  
4. Close: *“Same payload the dashboard uses. No Excel macros.”*

---

## 7. Menu map (where to click)

Quality sidebar / workspace lists (names as in the app):

| Menu | URL | Show this demo row |
|------|-----|--------------------|
| Overview | `/quality` | KPIs, funnel, recalls, PPAP, SCAR |
| Inspection Plans | `/quality/plans` | DEMO-QPL-IQC-DISC (and IPQC / FQC plans) |
| Sampling Plans | `/quality/sampling-plans` | DEMO-SMP-AQL15 |
| Characteristics | `/quality/characteristics` | DEMO-CHR-OD |
| Defect Types | `/quality/defect-types` | DEMO-DT-RUNOUT |
| PFMEA | `/quality/pfmeas` | DEMO-PFMEA-ENG |
| Incoming | `/quality/incoming-inspections` | DEMO-QM-IQC-0001 |
| In-Process | `/quality/inprocess-inspections` | DEMO-QM-IPQC-0001 |
| Final | `/quality/final-inspections` | DEMO-QM-FQC-0001 |
| VIN Traces | `/quality/vin-traces` | DEMO-QM-VIN-0001 |
| Defects | `/quality/defects` | DEMO-QM-DEF-0001 |
| NCRs | `/quality/ncrs` | DEMO-QM-NCR-0001 |
| SCARs | `/quality/scars` | DEMO-QM-SCAR-0001 |
| CAPAs | `/quality/capas` | *(empty in this seed)* |
| PPAP | `/quality/ppaps` | DEMO-QM-PPAP-0001 |
| Warranty | `/quality/warranty-claims` | DEMO-QM-WRN-0001 |
| Recalls | `/quality/recalls` | DEMO-QM-RCL-0001 |
| Reports | `/quality/reports` | summaries + CSV |

Top tab bar also has Overview, Plans, Incoming, In-Process, Final, Defects, NCRs, CAPAs, Audits, Complaints, Supplier, Reports. **SCAR, PPAP, VIN, warranty, recall** are in the module resource lists / Quality workspace groups if they are not on that short tab bar — use the Quality home cards or `/quality/...` URLs above.

---

## 8. If someone asks an awkward question

| Question | Answer |
|----------|--------|
| Why empty lists? | Company is not **DEMO-HMC**. |
| Where is the GRN? | Not wired. IQC is created in Quality; `source_document_id` can point at a receipt later. |
| Where is the work order? | IPQC/FQC need a production order UUID; MFG list is empty so this demo used a stub. |
| Can I delete demo before production? | Already wiped (2026-09-09). Seed/teardown scripts removed. |
| Is this real Hero data? | No. Codes are `DEMO-*`. VIN is a legal 17-character fake: **MBLDEM00TEST00001**. |
| Warranty vs complaint? | Separate. Warranty needs VIN. Complaint is the customer-quality ticket. |
| Will this post to Finance? | Not from warranty/recall. IQC may call Inventory quarantine/release only. |

---

## 9. Suggested slide order (if you use slides)

1. Quality is the QC desk — three gates + fail path  
2. Architecture one-liner: no own product master; UUID + `source_module`  
3. Live: dashboard  
4. Live: IQC 100 / 97 / 3 and 240.5 mm  
5. Live: NCR then SCAR  
6. Live (optional): VIN + warranty + recall  
7. Reports / what is next (GRN→IQC, IATF package, VIN list on recall)

---

## 10. Re-seed

**Not available.** `seed_quality_hero_demo` and the live Hero catalog were removed (2026-09-09). Restore only from `_archived` if you intentionally rebuild a throwaway demo environment.
