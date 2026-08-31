# Payroll Phase 0 — Locked company policy

This document is the **authoritative business spec** stored in code as `PayPayrollPolicy` and `payroll_policy_spec.default_company_payroll_policy_fields()`.

Later phases (payroll run, payslip, leave accrual) must **read** this policy instead of hard-coded percentages.

## Two calendars

| Calendar | Period | Used for |
|----------|--------|----------|
| **Salary / payroll** | **20th → 20th** (next month 19th/20th) | Attendance, LOP, payable gross, payslip |
| **Leave** | **1st → last day of month** | Leave balance, monthly credit |
| **Leave credit timing** | **After calendar month end** | Accrual jobs; not tied to 20–20 pay window |

### Leave apply rules (enforced)

| Rule | Behaviour |
|------|-----------|
| Dates **21–30/31** | Still that **calendar** month’s leave (not the next payroll cycle) |
| Future calendar month | **Blocked** until that month starts |
| Monthly credit for month M | Available **after M ends** (typically from **1st of M+1**); cannot use early |
| Past leave dates | **Allowed** after credit posts (e.g. apply 25 Aug leave on 3 Sep once Aug credit is added) |
| Salary cut | Via LOP in the **20–20** payroll window only |

## Monthly package (X)

| Component | Formula |
|-----------|---------|
| Gross (fixed salary) | **X** |
| Basic | **60% × X** (on payable gross after LOP proration) |
| HRA | **50% × Basic** |
| Special allowance | **Payable gross − Basic − HRA** |
| PF (fixed, all employees) | **₹3,700** (₹1,800 employee + ₹1,900 employer) |
| Net (this company) | **Payable gross − ₹3,700** (`gross_minus_fixed_pf_total`) |

Example **X = 30,000**, full month: net **₹26,300**.

## LOP and per-day rate

- **Source:** attendance (and unpaid leave when no row — see `attendance_rules_json`).
- **Proration:** `payable_gross = X × (paid_days / N)`.
- **N:** `shift_scheduled_days` in the 20–20 period (Phase 2 implements counting).
- **Per-day deduction:** `X / N` per LOP day (equivalent to proration above).

### Default attendance mapping (`attendance_rules_json`)

| Category | Statuses |
|----------|----------|
| LOP (1 day) | `absent` |
| LOP (0.5 day) | `half_day` |
| Paid (no LOP) | `present`, `work_from_home`, `holiday`, `week_off`, `on_duty`, `late`, `miss_punch` |

## API (Phase 0)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/payroll/policies/defaults` | Code defaults (no DB) |
| GET | `/payroll/policies/resolved` | Active DB policy merged over defaults |
| GET | `/payroll/policies/active` | Active row or null |
| POST | `/payroll/policies/ensure-default` | Create `DEFAULT` active policy for company |
| GET/POST/PATCH | `/payroll/policies` | CRUD |
| POST | `/payroll/policies/{id}/activate` | Activate (archives other active for company) |

Permissions: `payroll.period:read|create|update`.

## Database

Table: `payroll.pay_payroll_policy` (migration `0471_pay_payroll_policy`).

Run migration:

```bash
cd apps/api && alembic upgrade head
```

## Not in Phase 0

- Payroll run engine still uses legacy 40/20 and 12% PF until Phase 4.
- ~~No auto **20–20** periods until Phase 1.~~ **Done in Phase 1** — see `PHASE1-PERIODS.md`.
- Shift-based **N** until Phase 2.
