# Payroll Phase 4 — Salary structure & fixed PF

## Policy-driven calculation

Payroll runs load **`PayPayrollPolicy`** (or code defaults) and pass it to `PayrollRunEngine.compute_salary_breakdown`.

### Default company package (₹X monthly)

| Component | Formula |
|-----------|---------|
| Basic | `basic_percent × gross` (default **60%**) |
| HRA | `hra_percent_of_basic × basic` (default **50%**) |
| Special | `gross − basic − hra` |
| Employee PF | **₹1,800** (`pf_employee_amount`) |
| Employer PF | **₹1,900** (`pf_employer_amount`) |
| PF total | **₹3,700** |
| Net | `gross − 3,700` when `net_pay_formula = gross_minus_fixed_pf_total` |

Example **X = 30,000**, full month: net **₹26,300**.

Proration (from Phase 2–3) applies to **gross first**, then components split on payable gross.

### Modes

| `pf_mode` | Behavior |
|-----------|----------|
| `fixed_split` | Fixed EE/ER amounts; ESI/PT = 0 |
| `fixed_total` | Uses `pf_total_amount` |
| `statutory_percent` | Legacy 12% PF + ESI + PT engine |

If `policy` is omitted on the engine API, **legacy 40/20 + statutory** is used (backward compatible).

## Code

- `modules/payroll/domain/payroll_salary_calculator.py`
- `PayrollRunService.calculate` → `PayrollPolicyService.get_active_or_defaults`

## Tests

```bash
pytest src/tests/unit/payroll/test_payroll_salary_calculator.py -q
```

## Next (Phase 5)

Payslip UI polish, end-to-end QA, optional `statutory_percent` companies via policy only.
