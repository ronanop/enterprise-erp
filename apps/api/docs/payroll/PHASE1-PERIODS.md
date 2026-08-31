# Payroll Phase 1 — Periods & leave calendar

## Salary cycle (20 → 20)

- Anchor month = **payment / salary month** (`payroll_month`, `payroll_year`).
- Example **February 2026**: `start_date = 20 Jan 2026`, `end_date = 19 Feb 2026`.
- `period_code`: `PAY-2026-02`
- Default `payment_date`: **20th** of anchor month.
- Cycle start day comes from active **`PayPayrollPolicy.payroll_cycle_start_day`** (default **20**).

### API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/payroll/payroll-periods/generate` | Body: `payroll_year`, `payroll_month`, `count`, optional `cycle_start_day` |
| POST | `/payroll/payroll-periods/ensure-current` | Create/open period containing today |
| POST | `/payroll/payroll-periods/{id}/start-processing` | Status → `processing` |
| POST | `/payroll/payroll-periods/{id}/approve` | Status → `approved` |
| POST | `/payroll/payroll-periods/{id}/close` | Status → `closed` |
| POST | `/payroll/payroll-periods/{id}/reopen` | `closed`/`cancelled` → `open` |
| POST | `/payroll/payroll-periods/{id}/cancel` | → `cancelled` |

### Example generate

```json
POST /payroll/payroll-periods/generate
{
  "payroll_year": 2026,
  "payroll_month": 2,
  "count": 3,
  "skip_existing": true
}
```

Creates Feb, Mar, Apr 2026 anchors (20–20 windows).

## Leave cycle (calendar 1–31)

- Leave accrual task `hr.leave_balance_accrual` credits the **last completed calendar month** when `period_yyyymm` is not passed.
- Example: run on **1 Mar 2026** → accrues **`2026-02`** (not March, not payroll 20–20).
- Manual override: `leave_balance_accrual.delay("2026-01")`.

Helper: `modules.hr.domain.leave_accrual_calendar.completed_calendar_month_yyyymm`.

Apply/submit/approve also use `modules.hr.domain.leave_cycle_rules`:
- no leave days in a **future** calendar month
- balance check uses **posted** credits only (cannot borrow next month’s credit early)
- **past** dates allowed after credit posts (cover prior holidays)

## Payroll run

- `PayrollRunService.calculate` **requires** a payroll period with `start_date` and `end_date`.
- Attendance and leave facts are filtered to **`[start_date, end_date]`** inclusive.

## Tests

```bash
cd apps/api
pytest src/tests/unit/payroll/test_payroll_period_calendar.py src/tests/unit/hr/test_leave_accrual_calendar.py src/tests/unit/hr/test_leave_cycle_rules.py -q
```

## Next (Phase 2)

Shift-based **N** for `X × (paid_days / N)`.
