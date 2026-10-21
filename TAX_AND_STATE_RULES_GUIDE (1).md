# CACHE GROUP — COMPREHENSIVE TAX, STATUTORY & STATE RULES GUIDE
**Applicable Entities:** 
- **CACHE TECHNOLOGIES** (`CT`)
- **CACHE DIGITECH PRIVATE LIMITED** (`CDPL`)

**Active Assessment Period:** FY 2025-26 & FY 2026-27 (Starting Period: April 2026 / `2026-04`)  
**Engine Reference:** CACHE HRMS Statutory Engine & Tax Engine  
**Document Classification:** Official Payroll & Statutory Compliance Documentation  

---

## TABLE OF CONTENTS
1. [Corporate Entity Structure & Multi-Company Matrix](#1-corporate-entity-structure--multi-company-matrix)
2. [Income Tax (TDS under Section 192) Rules & Calculation Base](#2-income-tax-tds-under-section-192-rules--calculation-base)
   - 2.1 [Old Tax Regime (Section 115BAC Opt-Out)](#21-old-tax-regime-section-115bac-opt-out)
   - 2.2 [New Tax Regime (Section 115BAC Default)](#22-new-tax-regime-section-115bac-default)
   - 2.3 [Monthly TDS Deduction Methodology & Pro-Rata Projection](#23-monthly-tds-deduction-methodology--pro-rata-projection)
   - 2.4 [Allowable Deductions, Exemptions & Proof Verification](#24-allowable-deductions-exemptions--proof-verification)
3. [Employees' Provident Fund (EPF & MP Act, 1952)](#3-employees-provident-fund-epf--mp-act-1952)
   - 3.1 [Statutory Baseline & Split of Contribution](#31-statutory-baseline--split-of-contribution)
   - 3.2 [Cache Group ₹25,000 Maximum Cap Policy (`COMPANY_CAP_25K`)](#32-cache-group-25000-maximum-cap-policy-company_cap_25k)
   - 3.3 [Employee-Wise EPF Configuration Options](#33-employee-wise-epf-configuration-options)
   - 3.4 [Deduction Schemes: Employee Only vs Whole Amount](#34-deduction-schemes-employee-only-vs-whole-amount)
4. [Employees' State Insurance (ESI Act, 1948)](#4-employees-state-insurance-esi-act-1948)
   - 4.1 [Statutory Wage Ceiling & Contribution Percentages](#41-statutory-wage-ceiling--contribution-percentages)
   - 4.2 [Employee-Wise ESI Configuration Options](#42-employee-wise-esi-configuration-options)
   - 4.3 [Deduction Schemes: Employee Only vs Whole Amount](#43-deduction-schemes-employee-only-vs-whole-amount-1)
5. [State-Wise Professional Tax (PT) Master Rules](#5-state-wise-professional-tax-pt-master-rules)
   - 5.1 [Maharashtra (MH) Rules, Slabs & Women Exemption](#51-maharashtra-mh-rules-slabs--women-exemption)
   - 5.2 [NCT of Delhi (DL) Exemption](#52-nct-of-delhi-dl-exemption)
   - 5.3 [Karnataka (KA) Rules & Slabs](#53-karnataka-ka-rules--slabs)
   - 5.4 [Gujarat, West Bengal, Tamil Nadu, Telangana, Andhra Pradesh](#54-other-states-quick-reference-matrix)
6. [Labour Welfare Fund (LWF) Rules by State](#6-labour-welfare-fund-lwf-rules-by-state)
7. [Statutory Compliance Calendar & Due Dates](#7-statutory-compliance-calendar--due-dates)
8. [Summary Configuration Table for Admin Master](#8-summary-configuration-table-for-admin-master)

---

## 1. Corporate Entity Structure & Multi-Company Matrix

CACHE HRMS operates a dual-entity multi-tenant structure allowing employees to be categorized under either entity with independent statutory registrations and company-branded single-page payslips:

| Parameter | CACHE TECHNOLOGIES (`CT`) | CACHE DIGITECH PRIVATE LIMITED (`CDPL`) |
| :--- | :--- | :--- |
| **Legal Entity** | Cache Technologies | Cache Digitech Private Limited |
| **Corporate Status** | Partnership / Proprietary Enterprise | Private Limited Company |
| **Registered Office** | L-31, Kailash Colony, South Delhi, Delhi - 110048 | L-31, Kailash Colony, South Delhi, Delhi - 110048 |
| **Head Office** | L-31 Ground Floor, Kailash Colony, New Delhi - 110048 | L-31 Ground Floor, Kailash Colony, New Delhi - 110048 |
| **PAN / TAN** | `AAWPG7418G` / `AAWPG7418G` | `AAWPG7418G` / `AAWPG7418G` |
| **Head of HR** | Shweta Gaba | Shweta Gaba |
| **Authorized Signatory** | Vineet Kumar Gupta | Vineet Kumar Gupta |
| **Brand Tagline** | *Building Tomorrow* | *Empowering Digital Transformation* |
| **EPF Default Ceiling** | ₹25,000 (`COMPANY_CAP_25K`) | ₹25,000 (`COMPANY_CAP_25K`) |
| **ESI Default Ceiling** | ₹21,000 (`STANDARD_21K`) | ₹21,000 (`STANDARD_21K`) |

---

## 2. Income Tax (TDS under Section 192) Rules & Calculation Base

Under Section 192 of the Income Tax Act, 1961, employers are statutorily required to deduct income tax from estimated employee salaries on an average monthly rate.

### 2.1 Old Tax Regime (Section 115BAC Opt-Out)
Employees who submit an explicit declaration to opt out of the default New Regime are taxed under the Old Regime tax slabs:

#### Income Tax Slabs (Old Regime)
| Net Taxable Income Slab | Tax Rate | Calculation Formula |
| :--- | :--- | :--- |
| **Up to ₹2,50,000** | **0% (Nil)** | ₹0 |
| **₹2,50,001 to ₹5,00,000** | **5%** | $5\% \times (\text{Taxable Income} - 250000)$ |
| **₹5,00,001 to ₹10,00,000** | **20%** | $₹12,500 + [20\% \times (\text{Taxable Income} - 500000)]$ |
| **Above ₹10,00,000** | **30%** | $₹1,12,500 + [30\% \times (\text{Taxable Income} - 1000000)]$ |

#### Key Provisions (Old Regime)
- **Standard Deduction**: **₹50,000** flat deduction under Section 16(ia).
- **Section 87A Tax Rebate**:
  - Maximum rebate: **₹12,500**.
  - Threshold: Available if Net Taxable Income $\le$ **₹5,00,000**.
  - Net tax payable becomes **₹0** for taxable income up to ₹5,00,000.
- **Health & Education Cess**: **4%** applied on total income tax after rebate.

---

### 2.2 New Tax Regime (Section 115BAC Default)
The New Tax Regime is the default regime under the Finance Act for FY 2025-26 & FY 2026-27.

#### Income Tax Slabs (New Regime)
| Net Taxable Income Slab | Tax Rate | Marginal Tax Payable |
| :--- | :--- | :--- |
| **Up to ₹3,00,000** | **0% (Nil)** | ₹0 |
| **₹3,00,001 to ₹7,00,000** | **5%** | Max ₹20,000 ($4,00,000 \times 5\%$) |
| **₹7,00,001 to ₹10,00,000** | **10%** | Max ₹30,000 ($3,00,000 \times 10\%$) |
| **₹10,00,001 to ₹12,00,000** | **15%** | Max ₹30,000 ($2,00,000 \times 15\%$) |
| **₹12,00,001 to ₹15,00,000** | **20%** | Max ₹60,000 ($3,00,000 \times 20\%$) |
| **Above ₹15,00,000** | **30%** | $30\% \times (\text{Taxable Income} - 1500000)$ |

#### Key Provisions (New Regime)
- **Standard Deduction**: **₹75,000** flat deduction under Section 16(ia) (Enhanced in Union Budget).
- **Section 87A Tax Rebate**:
  - Maximum rebate: **₹25,000**.
  - Threshold: Available if Net Taxable Income $\le$ **₹7,00,000**.
  - Combined with the ₹75,000 standard deduction, employees earning gross annual salary up to **₹7,75,000** pay **₹0 Income Tax**!
  - **Marginal Relief**: For income marginally above ₹7,00,000, tax cannot exceed the income exceeding ₹7,00,000.
- **Deductions Disallowed in New Regime**: 
  - Section 80C, 80D, 80E, 80TTA, 24(b) (Self-occupied home loan interest), Section 10(13A) HRA, Section 10(14) Conveyance/LTA exemptions are **NOT** available.
- **Allowed Deduction in New Regime**:
  - Section 80CCD(2) — Employer contribution to NPS (up to 14% of Basic + DA for Central Govt, 10% for Private/Corporate).
- **Health & Education Cess**: **4%** applied on total income tax.

---

### 2.3 Monthly TDS Deduction Methodology & Pro-Rata Projection

The engine calculates monthly TDS using Section 192 pro-rata averaging:

$$\text{Projected Annual Gross} = \text{YTD Actual Earnings} + (\text{Current Month Gross} \times \text{Balance Months})$$

$$\text{Estimated Taxable Income} = \text{Projected Annual Gross} - \text{Standard Deduction} - \text{Approved Chapter VI-A Deductions}$$

$$\text{Estimated Annual Tax} = \text{Slab Tax}(\text{Estimated Taxable Income}) - \text{Section 87A Rebate} + 4\% \text{ Cess}$$

$$\text{Current Month TDS} = \frac{\text{Estimated Annual Tax} - \text{TDS Deducted YTD}}{\text{Remaining Months in Financial Year}}$$

*Note:* If an employee joins mid-year or salary increases/decreases, the denominator automatically rebalances future monthly TDS evenly over the remaining months without creating sudden end-of-year tax shocks.

---

### 2.4 Allowable Deductions, Exemptions & Proof Verification

| Section | Description | Max Limit (Old Regime) | New Regime Status |
| :--- | :--- | :--- | :--- |
| **16(ia)** | Standard Deduction on Salary | ₹50,000 | **₹75,000** |
| **80C** | EPF, ELSS, PPF, Life Insurance, Sukanya Samriddhi, Home Loan Principal, Tuition Fees | ₹1,50,000 | Disallowed |
| **80CCD(1B)** | Additional Voluntary NPS Contribution | ₹50,000 | Disallowed |
| **80CCD(2)** | Employer Contribution to NPS | 10% of Basic | **Allowed (10% of Basic)** |
| **80D** | Health Insurance (Self, Spouse, Children) | ₹25,000 (₹50,000 if Senior) | Disallowed |
| **80D** | Health Insurance (Parents) | ₹25,000 (₹50,000 if Senior) | Disallowed |
| **80E** | Interest on Higher Education Loan | Full interest (8 yrs) | Disallowed |
| **24(b)** | Interest on Housing Loan (Self-Occupied) | ₹2,00,000 | Disallowed |
| **10(13A)** | House Rent Allowance (HRA) Exemption | Least of 3 statutory formulas | Disallowed |
| **10(14)** | Conveyance / Official Travel Reimbursement | Actual incurred for business | Allowed on actuals |

#### Statutory Formula for Section 10(13A) HRA Exemption:
The exempt amount is the **minimum** of:
1. Actual HRA received from employer.
2. Rent paid in excess of $10\%$ of salary (Basic + DA).
3. $50\%$ of salary if residing in a metro city (Mumbai, Delhi, Kolkata, Chennai) or $40\%$ for non-metro cities.

---

## 3. Employees' Provident Fund (EPF & MP Act, 1952)

### 3.1 Statutory Baseline & Split of Contribution
The Employees' Provident Funds and Miscellaneous Provisions Act, 1952 applies to organizations with 20 or more employees.

- **Statutory Wage Ceiling**: **₹15,000 per month** (Basic + DA + Retaining Allowance).
- **Total Statutory Contribution**: **24%** of EPF base wage + Admin/EDLI charges.

#### Statutory Contribution Breakdown:
| Component | Borne By | Percentage | Statutory Ceiling Base (₹15,000) |
| :--- | :--- | :--- | :--- |
| **Employee EPF** | Employee | **12.00%** | **₹1,800.00** |
| **Employer EPS** (Pension) | Employer | **8.33%** | **₹1,250.00** (Capped at ₹15,000) |
| **Employer EPF** (Provident) | Employer | **3.67%** | **₹550.00** ($12\% - 8.33\%$) |
| **EDLI Contribution** | Employer | **0.50%** | **₹75.00** (Capped at ₹15,000) |
| **EPF Admin Charges** | Employer | **0.50%** | **₹75.00** (Minimum ₹500/establishment) |
| **Total Employer Burden** | Employer | **13.00%** | **₹1,950.00** |

---

### 3.2 Cache Group ₹25,000 Maximum Cap Policy (`COMPANY_CAP_25K`)

To provide superior retirement savings compared to the bare statutory minimum of ₹15,000 while maintaining a prudent corporate wage ceiling, Cache Group enforces a company policy cap of **₹25,000**:

$$\text{EPF Base Wages} = \min(\text{Basic Salary}, 25000.0)$$

$$\text{Employee PF Deduction} = \text{EPF Base Wages} \times 12\%$$

#### Calculation Table under ₹25,000 Company Cap:
| Employee Basic Salary | EPF Wage Base | Employee Deduction (12%) | Employer EPS (8.33% cap 15k) | Employer EPF (Diff) | Total Employer PF |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **₹12,000** | ₹12,000 | **₹1,440** | ₹1,000 | ₹440 | ₹1,440 |
| **₹15,000** | ₹15,000 | **₹1,800** | ₹1,250 | ₹550 | ₹1,800 |
| **₹20,000** | ₹20,000 | **₹2,400** | ₹1,250 | ₹1,150 | ₹2,400 |
| **₹25,000** | ₹25,000 | **₹3,000** | ₹1,250 | ₹1,750 | ₹3,000 |
| **₹30,000** (Salary $>$ 25k) | **₹25,000** (Capped) | **₹3,000** (Max Cap) | ₹1,250 | ₹1,750 | ₹3,000 |
| **₹50,000** (Salary $>$ 25k) | **₹25,000** (Capped) | **₹3,000** (Max Cap) | ₹1,250 | ₹1,750 | ₹3,000 |
| **₹1,00,000** (Salary $>$ 25k) | **₹25,000** (Capped) | **₹3,000** (Max Cap) | ₹1,250 | ₹1,750 | ₹3,000 |

*Rule Summary:* Any employee whose basic salary is greater than ₹25,000 will have their EPF wage base strictly capped at ₹25,000 with a maximum monthly employee deduction of **₹3,000**.

---

### 3.3 Employee-Wise EPF Configuration Options

CACHE HRMS allows setting customized statutory rules per employee via the Admin Master or Excel onboarding:

| Option Code | Display Label | Description & Calculation Logic |
| :--- | :--- | :--- |
| `COMPANY_CAP_25K` | **Company Cap (₹25,000)** | Default company policy. Capped at ₹25,000 (12% = ₹3,000 max). |
| `STATUTORY_15K` | **Statutory Ceiling (₹15,000)** | Follows statutory ceiling of ₹15,000 (12% = ₹1,800 max). |
| `ACTUAL_BASIC` | **Higher PF on Actual Basic** | Uncapped 12% calculation on the full basic wages. |
| `CUSTOM_LIMIT` | **Custom Wage Ceiling** | HR enters custom limit in `pf_custom_limit` (e.g. ₹20,000 &rarr; 12% = ₹2,400). |
| `FIXED_AMOUNT` | **Fixed Monthly Rupee Amount** | HR enters exact rupee deduction in `pf_fixed_amount` (e.g. ₹2,750). |
| `EXEMPT` | **Exempt / Not Applicable** | Sets `pf_applicable = 0` (Deduction = ₹0). |

---

### 3.4 Deduction Schemes: Employee Only vs Whole Amount

CACHE HRMS supports two payroll deduction schemes on an employee-by-employee basis:

1. **`EMPLOYEE_ONLY` (Standard Statutory Mode)**:
   - Employee deduction = 12% of wage base.
   - Employer portion (12%) is paid separately by the company as part of the CTC package.
   - *Example:* Wage Base ₹25,000 &rarr; Deducted from Employee = **₹3,000**.

2. **`BOTH_EMPLOYEE_AND_EMPLOYER` (Whole Amount Mode)**:
   - For specific compensation contracts where the employee agrees to bear the full statutory burden.
   - Total deduction from employee gross = Employee PF (12%) + Employer PF (12%) = **24% total**.
   - *Example:* Wage Base ₹25,000 &rarr; Deducted from Employee = $3000 + 3000 = \text{₹}6000$.

---

## 4. Employees' State Insurance (ESI Act, 1948)

### 4.1 Statutory Wage Ceiling & Contribution Percentages
The Employees' State Insurance Act, 1948 provides medical and social security benefits to employees:

- **Statutory Wage Threshold**: **₹21,000 per month** Gross Salary (₹25,000 for employees with physical disabilities).
- **Exemption Rule**: If an employee's gross monthly earnings exceed ₹21,000 in a wage period, they are completely exempt from ESI deductions.

#### Contribution Breakdown:
| Component | Borne By | Percentage of Gross Wages |
| :--- | :--- | :--- |
| **Employee Contribution** | Employee | **0.75%** |
| **Employer Contribution** | Employer | **3.25%** |
| **Total Contribution** | Remitted to ESIC | **4.00%** |

*Rounding Rule:* Total contribution is rounded off to the nearest higher rupee as mandated by ESI regulations.

---

### 4.2 Employee-Wise ESI Configuration Options

| Option Code | Display Label | Description & Calculation Logic |
| :--- | :--- | :--- |
| `STANDARD_21K` | **Standard Statutory (₹21,000)** | Applicable only if Gross $\le$ ₹21,000 (0.75% employee). Exempt above ₹21,000. |
| `CUSTOM_LIMIT` | **Custom Wage Threshold** | HR enters custom limit in `esi_custom_limit` (e.g. ₹25,000). |
| `FIXED_AMOUNT` | **Fixed Monthly Rupee Amount** | HR enters exact rupee deduction in `esi_fixed_amount`. |
| `EXEMPT` | **Exempt / Not Applicable** | Sets `esi_applicable = 0` (Deduction = ₹0). |

---

### 4.3 Deduction Schemes: Employee Only vs Whole Amount
1. **`EMPLOYEE_ONLY`**: Deducts standard **0.75%** of gross earnings from the employee.
2. **`BOTH_EMPLOYEE_AND_EMPLOYER`**: Deducts the entire **4.00%** (0.75% employee + 3.25% employer) from the employee's gross earnings.

---

## 5. State-Wise Professional Tax (PT) Master Rules

Professional Tax is governed by respective State Legislatures under Article 276 of the Constitution of India (maximum limit: ₹2,500 per annum).

### 5.1 Maharashtra (MH) Rules, Slabs & Women Exemption
**Legal Reference:** *Maharashtra State Tax on Professions, Trades, Callings and Employments Act, 1975*

#### Monthly Slabs (Male Employees):
| Monthly Gross Earnings Slab | Monthly Deduction (Apr – Jan) | February Deduction | Total Annual PT |
| :--- | :--- | :--- | :--- |
| **Up to ₹7,500** | **₹0 (Nil)** | **₹0 (Nil)** | **₹0** |
| **₹7,501 to ₹10,000** | **₹175** | **₹175** | **₹2,100** |
| **Above ₹10,000** | **₹200** | **₹300** | **₹2,500** |

#### Special Statutory Provisions in Maharashtra:
1. **February Extra Rule**: In the month of February, the deduction is increased from **₹200 to ₹300** so that the 12-month total equals exactly **₹2,500** ($11 \times 200 + 1 \times 300 = 2500$).
2. **Women Employee Exemption**: Under Government Notification (Finance Department), **female employees earning up to ₹25,000 per month are 100% exempt from Professional Tax**. For female employees earning $>$ ₹25,000/month, standard rates apply (₹200 for 11 months, ₹300 in Feb).
3. **Persons with Disabilities**: Persons having permanent physical disability (including blindness) are 100% exempt on submission of certificate.

---

### 5.2 NCT of Delhi (DL) Exemption
**Legal Reference:** *NCT of Delhi Professional Tax Status*
- **PT Deduction**: **₹0 (Nil)**.
- **Rule**: The Government of NCT of Delhi does **NOT** levy Professional Tax on salaried employees. All employees based in New Delhi HQ, Noida, or Gurgaon branch assigned to Delhi registration have ₹0 PT deducted.

---

### 5.3 Karnataka (KA) Rules & Slabs
**Legal Reference:** *Karnataka Tax on Professions, Trades, Callings and Employments Act, 1976*

| Monthly Gross Earnings Slab | Monthly Deduction | Total Annual PT |
| :--- | :--- | :--- |
| **Up to ₹15,000** | **₹0 (Nil)** | **₹0** |
| **₹15,001 and above** | **₹200** | **₹2,400** |

---

### 5.4 Other States Quick Reference Matrix

| State (Code) | Minimum Threshold | Monthly PT Amount | Special Month Rule | Annual Cap |
| :--- | :--- | :--- | :--- | :--- |
| **Gujarat (`GJ`)** | $>$ ₹12,000 | ₹200 / month | None | ₹2,400 |
| **West Bengal (`WB`)** | ₹10,001 – ₹15,000<br>₹15,001 – ₹25,000<br>₹25,001 – ₹40,000<br>$>$ ₹40,000 | ₹110<br>₹130<br>₹150<br>₹200 | None | ₹2,500 |
| **Tamil Nadu (`TN`)** | Half-Yearly Basis: $>$ ₹1,00,000 | ₹208.33 / month | Half-yearly recovery (Sep & Feb) | ₹2,500 |
| **Telangana (`TS`)** | ₹15,001 – ₹20,000<br>$>$ ₹20,000 | ₹150 / month<br>₹200 / month | None | ₹2,400 |
| **Andhra Pradesh (`AP`)** | ₹15,001 – ₹20,000<br>$>$ ₹20,000 | ₹150 / month<br>₹200 / month | None | ₹2,400 |
| **Uttar Pradesh (`UP`)** | Exempt | ₹0 | No PT currently levied | ₹0 |
| **Haryana (`HR`)** | Exempt | ₹0 | No PT currently levied | ₹0 |

---

## 6. Labour Welfare Fund (LWF) Rules by State

LWF is a state-specific statutory contribution for employee welfare activities:

| State | Employee Share | Employer Share | Frequency | Due Date |
| :--- | :--- | :--- | :--- | :--- |
| **Maharashtra (`MH`)** | ₹12.00 | ₹36.00 | Half-Yearly (June & Dec) | 15th July / 15th January |
| **Delhi (`DL`)** | ₹0.75 | ₹2.25 | Half-Yearly (June & Dec) | 15th July / 15th January |
| **Karnataka (`KA`)** | ₹20.00 | ₹40.00 | Annually (December) | 15th January |
| **Gujarat (`GJ`)** | ₹6.00 | ₹12.00 | Half-Yearly (June & Dec) | 15th July / 15th January |
| **Telangana (`TS`)** | ₹20.00 | ₹50.00 | Annually (December) | 31st January |

---

## 7. Statutory Compliance Calendar & Due Dates

| Compliance Item | Governing Authority | Frequency | Statutory Due Date | Challan / Return Form |
| :--- | :--- | :--- | :--- | :--- |
| **TDS Payment (Sec 192)** | Income Tax Department | Monthly | **7th of next month** (30th April for March) | Challan ITNS 281 |
| **TDS Return (24Q)** | Income Tax Department | Quarterly | **Q1: 31 Jul, Q2: 31 Oct, Q3: 31 Jan, Q4: 31 May** | Form 24Q (Annexure I & II) |
| **Form 16 Issuance** | Income Tax Department | Annual | **15th June** | Form 16 Part A & Part B |
| **EPF Remittance** | EPFO | Monthly | **15th of next month** | ECR (Challan) |
| **ESI Remittance** | ESIC | Monthly | **15th of next month** | Monthly Contribution Challan |
| **PT Remittance (MH)** | Maharashtra Sales Tax Dept | Monthly | **Last day of month / 20th of next month** | Form III-B Challan |
| **PT Annual Return (MH)** | Maharashtra Sales Tax Dept | Annual | **31st March** | Form III-A |
| **PT Remittance (KA)** | Karnataka Commercial Taxes | Monthly | **20th of next month** | Form 5A |

---

## 8. Summary Configuration Table for Admin Master

When onboarding or editing employee statutory setups in CACHE HRMS Admin Portal:

| Configuration Field | Supported Values | Default Recommendation |
| :--- | :--- | :--- |
| **Company Entity** | `CT` (Cache Technologies) or `CDPL` (Cache Digitech Pvt Ltd) | Choose per employment offer letter |
| **Tax Regime** | `Old Regime` or `New Regime` | `New Regime` (Default as per IT Act) |
| **EPF Applicable** | `1` (Yes) or `0` (No) | `1` (Yes) |
| **EPF Limit Type** | `COMPANY_CAP_25K`, `STATUTORY_15K`, `ACTUAL_BASIC`, `CUSTOM_LIMIT`, `FIXED_AMOUNT`, `EXEMPT` | **`COMPANY_CAP_25K`** |
| **EPF Custom Limit** | Decimal (₹) | ₹25,000.00 |
| **EPF Fixed Amount** | Decimal (₹) | ₹0.00 |
| **EPF Deduction Scheme** | `EMPLOYEE_ONLY` or `BOTH_EMPLOYEE_AND_EMPLOYER` | `EMPLOYEE_ONLY` |
| **ESI Applicable** | `1` (Yes) or `0` (No) | `1` (Yes) if Gross $\le$ 21,000, else `0` |
| **ESI Limit Type** | `STANDARD_21K`, `CUSTOM_LIMIT`, `FIXED_AMOUNT`, `EXEMPT` | **`STANDARD_21K`** |
| **ESI Deduction Scheme** | `EMPLOYEE_ONLY` or `BOTH_EMPLOYEE_AND_EMPLOYER` | `EMPLOYEE_ONLY` |
| **PT Applicable** | `1` (Yes) or `0` (No) | `1` for MH / KA; `0` for DL |
| **Work State** | `MH` (Maharashtra), `DL` (Delhi), `KA` (Karnataka), etc. | Based on posting location |

---
*Document Version: 2.1 — Reflected live in CACHE HRMS Database (`cache_hrms.db`), Statutory Engine (`statutory_engine.py`), and Tax Engine (`tax_engine.py`).*
