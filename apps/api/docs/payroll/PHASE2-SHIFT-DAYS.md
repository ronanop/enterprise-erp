# Payroll Phase 2 — Shift-based period days (N)

## Denominator N

Configured on company payroll policy (`period_day_denominator`):

| Mode | N |
|------|---|
| `shift_scheduled_days` (default) | Working days in period after weekly-off + holiday rules, roster, and management-group shift |
| `all_calendar_days_in_period` | Every calendar day from `start_date` to `end_date` |
| `fixed_30` | Always 30 |

## Shift resolution (per employee, per day)

1. Published **roster** entry for that date  
2. Else **approved/active shift assignment** covering the date  
3. Else **management group** `default_shift_id` from employment  

## Payable days

```text
paid_days = N − LOP
LOP       = sum from attendance in period (absent / half_day per policy rules)
prorate   = paid_days / N
```

Stored on each payroll run line:

- `period_days` (N)
- `paid_days`, `lop_days`, `leave_days`
- `primary_shift_id` (shift at period end)
- `day_summary_json` (counts: scheduled_working, week_off, holiday, present, absent, …)

## Preview API

```http
GET /payroll/payroll-periods/{period_id}/employee-day-ledger?employee_id={uuid}
```

## Migration

`0472_pay_run_line_period_days`

## Next (Phase 3)

Unpaid leave overlay, richer attendance→LOP from leave types.
