# Payslip — TDS, Deduction (B), YTD & Tax Summary Understanding

**Product:** iConnect Plus  
**Scope:** Salary slip calculation for Earnings (A), Deductions (B), Year to date, Annual projection, Tax summary  
**Date:** 30 Oct 2026  
**Status:** Understanding + implementation notes (payslip UI/PDF aligned Oct 2026)

---

## 1. Two different concepts

| Concept | Meaning | Typical items |
|---|---|---|
| **Deduction (B)** | Amounts cut from **this month’s** salary before net pay | PF, ESI, Professional tax, **TDS**, LOP, late, loan, etc. |
| **Tax / TDS** | Income-tax estimate for the **financial year**, recovered monthly as TDS | Estimated annual tax, YTD TDS, Balance TDS |

Both can reduce cash to the employee, but they are not the same math:

- Deduction (B) = **payroll month math**
- Tax summary = **FY tax math** (gross → exemptions → taxable → annual tax → monthly TDS)

In a correct slip, the **TDS line inside Deduction (B)** must match the **tax / projection / balance** story.

---

## 2. Reference design (uploaded image — Amit Sharma, Dec 2025)

This is the **intended behaviour** for how sections should connect.

### 2.1 Earnings (A)

| Component | Monthly | Yearly |
|---|---:|---:|
| Basic | 30,000 | 3,60,000 |
| HRA | 15,000 | 1,80,000 |
| Special Allowance | 20,000 | 2,40,000 |
| Conveyance | 3,200 | 38,400 |
| Medical | 1,250 | 15,000 |
| Other Allowance | 5,550 | 66,600 |
| Performance Incentive | 5,000 | 60,000 |
| **Total (A)** | **80,000** | **9,60,000** |

### 2.2 Deductions (B) — TDS lives here

| Component | Monthly | Yearly |
|---|---:|---:|
| Provident Fund (Employee) | 3,600 | 43,200 |
| ESI | 0 | 0 |
| Professional Tax | 200 | 2,600 |
| **Income Tax (TDS)** | **8,750** | **1,05,000** |
| Leave Without Pay (1 day) | 2,667 | 32,004 |
| Late Deduction (1) | 500 | 6,000 |
| Other Deduction | 0 | 0 |
| **Total (B)** | **15,717** | **1,88,804** |

**Net payable** = A − B = 80,000 − 15,717 = **₹64,283**

**TDS rule in this design:**

```text
Monthly TDS (Deduction B)     = ₹8,750
Yearly TDS                    = ₹8,750 × 12 = ₹1,05,000
```

That yearly TDS is the **single annual tax number** reused in Annual projection and Tax summary.

### 2.3 Year to date (Apr 2025 – Dec 2025) — 9 months posted

| Field | Amount | Meaning |
|---|---:|---|
| Total earnings | 7,20,000 | Posted gross so far |
| Total deductions | 1,28,804 | Posted deductions so far |
| Net salary paid | 5,91,196 | Earnings − deductions |
| **TDS deducted** | **78,750** | **9 × ₹8,750** already withheld |
| PF (employee) | 32,400 | 9 × ₹3,600 |
| Professional tax | 2,200 | Actual PT posted |
| LOP deduction | 8,001 | Actual LOP so far |

**Understanding:** YTD TDS = sum of TDS lines on posted payslips. It is **history**, not a forecast.

### 2.4 Annual projection (FY 2025-26)

| Field | Amount | Link |
|---|---:|---|
| Projected earnings | 9,60,000 | Same as Earnings (A) yearly |
| Projected deductions | 1,88,804 | Same as Deduction (B) yearly |
| Projected net | 7,71,196 | 9,60,000 − 1,88,804 |
| **Projected TDS** | **1,05,000** | Same as Deduction (B) yearly TDS |
| Balance months | 3 | Jan–Mar |
| Estimated TDS (next 3 months) | 26,250 | 3 × ₹8,750 |
| Estimated net (next 3 months) | 1,92,849 | Uses current-month style net × 3 |

### 2.5 Tax summary (FY 2025-26)

| Field | Amount | Role |
|---|---:|---|
| Annual gross salary | 9,60,000 | Same projected / yearly gross |
| Standard deduction | 50,000 | Tax deduction |
| HRA exemption (est.) | 1,20,000 | Tax exemption |
| Section 80C | 1,50,000 | Investment declaration |
| Section 80D | 25,000 | Health insurance declaration |
| Taxable income (est.) | 5,65,000 | Gross after tax deductions/exemptions |
| **Estimated annual tax** | **1,05,000** | Same as Projected TDS / Deduction (B) yearly TDS |
| **TDS deducted (YTD)** | **78,750** | Same as YTD TDS |
| **Balance TDS** | **26,250** | 1,05,000 − 78,750 (= next 3 × 8,750) |

### 2.6 Reference flow (how numbers must stay consistent)

```text
Earnings (A) monthly ₹80,000
        │
        ▼
Deduction (B) includes TDS ₹8,750  ──► Net ₹64,283
        │
        ├─► Yearly TDS column              = ₹1,05,000
        │
        ├─► YTD TDS (posted months × TDS)  = ₹78,750
        │
        └─► Tax summary / Annual projection
              Estimated / Projected TDS    = ₹1,05,000
              TDS deducted (YTD)           = ₹78,750
              Balance TDS                  = ₹26,250
```

**Rule:** Deduction (B) TDS ↔ Annual projection TDS ↔ Tax summary estimated/balance TDS must be **one consistent TDS story**.

---

## 3. Current product behaviour (live payslip — gap)

Example observed: high LOP month (24 LOP days), CTC-style monthly gross ~₹1,64,200.

### 3.1 What works

- Earnings (A) restored to full-month structure (Basic / HRA / Special, etc.).
- LOP shown under Deduction (B) as leave without pay.
- Net ≈ full-month earnings − Deduction (B).
- YTD can show posted gross / PF / LOP when data exists.

### 3.2 What is missing / wrong vs reference

| Area | Current behaviour | Required (reference) |
|---|---|---|
| **Deduction (B) TDS** | Often **no Income Tax (TDS) line** | TDS must appear in Deduction (B) monthly + yearly |
| **TDS base** | `fullMonthPay × 12` only (structure annualised) | Should follow tax path / projected annual gross, then monthly recovery |
| **LOP impact on tax** | LOP not used in TDS base | Annual gross for tax should reflect real/projected FY earnings after LOP |
| **YTD TDS** | Blank when no TDS line posted | Sum of TDS from posted slips |
| **Tax summary** | Standard / HRA / 80C / 80D / taxable hardcoded as **"—"** | Fill real values; show taxable income |
| **Estimated annual tax** | Copied from structure-based `tdsForTheYear`, ignores exemption rows | Same number as Projected TDS; driven by tax summary path |
| **Balance TDS** | Annual tax − YTD (often = full annual tax) | Remaining FY TDS (= months left × monthly TDS) |
| **Cross-section consistency** | Projection, Deduction (B), Tax summary can disagree | One TDS number everywhere |

### 3.3 Current code path (simplified)

Primary UI/PDF math lives in:

- `apps/web/src/utils/payslip-pdf.ts` — `payslipFigures`, `payslipProjection`, YTD context
- `apps/web/src/components/hr/payroll/payslip-letterhead.tsx` — Tax summary labels
- `apps/web/src/lib/salary-structure-excel.ts` — `tdsForTheYear` / `tdsForTheMonth` (new-regime style with ₹75,000 standard deduction inside formula)
- `apps/api/src/modules/payroll/domain/salary_structure_calculator.py` — same TDS formula on API

**Current TDS call pattern:**

```text
monthTds = tdsForTheMonth(fullMonthPay × 12)
yearTds  = tdsForTheYear(fullMonthPay × 12)
```

Tax summary UI currently prints `"—"` for:

- Standard deduction  
- HRA exemption  
- Section 80C  
- Section 80D  
- Taxable income  

…while still showing Estimated annual tax = `projection.tdsYear`. So exemption rows do **not** affect the tax figure.

### 3.4 Observed inconsistency example

| Section | Shown | Problem |
|---|---:|---|
| Earnings (A) yearly | ~19,70,400 | Full structure × 12 |
| Deduction (B) LOP | ~1,31,360 | One-time; in B but not in tax base |
| Projected earnings | ~18,39,040 | Reflects LOP in earnings path |
| Projected deductions | ~21,600 | Mostly PF only; LOP dropped from projection deductions |
| Projected / Estimated TDS | ~1,86,243 | Still on **full** 19,70,400, not on 18,39,040 |
| Tax summary exemptions | — | No impact |
| YTD TDS | — | No TDS line on slip |

---

## 4. Target calculation model (to implement)

### 4.1 Monthly payroll

```text
Net payable = Total Earnings (A) − Total Deductions (B)

Deduction (B) MUST include:
  - Statutory (PF, ESI, PT, …)
  - Income Tax (TDS) for the month
  - Attendance one-time (LOP, late, …)
```

### 4.2 Annual tax / TDS

```text
Annual gross (tax)     = Projected FY earnings (prefer projected/YTD-aware gross)
− Standard deduction
− HRA exemption (if regime allows)
− Section 80C
− Section 80D
= Taxable income

Estimated annual tax   = tax(regime, taxable income) + cess
TDS deducted (YTD)     = sum of TDS lines on posted slips
Balance TDS            = max(0, Estimated annual tax − TDS deducted YTD)
Monthly TDS            = Balance TDS ÷ months left in FY
                       (or posted TDS if already fixed for the month)
```

### 4.3 Consistency checks (acceptance)

1. Deduction (B) **Income Tax (TDS)** monthly ≈ Monthly TDS.  
2. Deduction (B) TDS yearly / Projected TDS / Tax summary Estimated annual tax = **same annual tax**.  
3. Tax summary TDS deducted (YTD) = Year to date TDS deducted.  
4. Balance TDS = Estimated annual tax − YTD TDS.  
5. Estimated TDS (next N months) = Monthly TDS × N (capped by months left).  
6. Tax summary exemption rows are **filled** (0 / N/A / amount), never silent unused `"—"` when tax is shown.

---

## 5. Section-by-section responsibility

| Section | Responsibility |
|---|---|
| **Earnings (A)** | Full-month structure (and variable one-time earnings). Yearly = recurring × 12 + one-time as posted. |
| **Deductions (B)** | All monthly cuts including **TDS**. One-time (LOP/late) should not blindly inflate “yearly” unless product explicitly wants that display. |
| **Net / CTC** | Net = A − B. CTC = earnings structure + employer contribution. |
| **Year to date** | Actual posted totals for FY to date, including TDS / PF / PT / LOP. |
| **Annual projection** | YTD + remaining months at recurring structure; Projected TDS = estimated annual tax. |
| **Tax summary** | Gross → exemptions → taxable → estimated tax → YTD TDS → Balance TDS. |
| **Next months TDS** | Monthly TDS repeated for remaining display months. |

---

## 6. Gap summary (one line)

**Reference slip:** TDS is inside Deduction (B), YTD TDS is real history, Tax summary exemptions are shown, and annual tax / balance TDS stay consistent everywhere.  

**Current slip:** TDS is computed only from full-year structure, often missing from Deduction (B), Tax summary impact rows are blank, and projection / tax / YTD do not share one TDS story.

---

## 7. Related code

| File | Role |
|---|---|
| `apps/web/src/utils/payslip-pdf.ts` | Figures, projection, YTD context, PDF tax blocks |
| `apps/web/src/components/hr/payroll/payslip-letterhead.tsx` | On-screen payslip tables + tax summary |
| `apps/web/src/lib/salary-structure-excel.ts` | `tdsForTheYear` / `tdsForTheMonth` |
| `apps/api/src/modules/payroll/domain/salary_structure_calculator.py` | API-side TDS formula |
| `apps/web/src/utils/payslip-pdf.test.ts` | Projection / LOP tests |

---

## 8. Source images used for this understanding

1. **Live / current-style slip** — high LOP month; blank tax exemption rows; TDS not aligned to Deduction (B) / projected earnings.  
2. **Reference slip (uploaded)** — Amit Sharma @ CACHE SOLUTIONS PVT. LTD., Dec 2025; full Deduction (B) with TDS; YTD TDS; Tax summary with exemptions; Balance TDS = remaining months × monthly TDS.

---

## 9. Implementation (Oct 2026)

Display/PDF layer now uses `buildPayslipView()` in `apps/web/src/utils/payslip-pdf.ts`:

1. **Projected earnings** (YTD-aware) = annual gross for tax.  
2. **Tax summary** filled for `new` (₹75k std; HRA/80C/80D = 0) and `old` (₹50k std; HRA est.; 80C from PF).  
3. **Income Tax (TDS)** injected into Deduction (B) when missing; net reduced accordingly.  
4. **YTD TDS / Balance TDS / Projected TDS / Estimated annual tax** share one tax story.  
5. Letterhead + PDF both render the filled tax summary (no blank `"—"` impact rows).
