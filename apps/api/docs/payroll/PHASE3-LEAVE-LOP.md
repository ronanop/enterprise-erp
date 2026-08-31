# Payroll Phase 3 — Attendance + leave → LOP

## Rules

LOP is calculated on **scheduled working days** only (same set used for denominator **N** when mode is `shift_scheduled_days`).

Per scheduled day:

| Situation | Payroll effect |
|-----------|----------------|
| Approved **paid** leave (leave type `is_paid=true`) | Paid day; **no LOP** even if attendance shows `absent` |
| Approved **unpaid** leave | **1 LOP** (no attendance row required) |
| Attendance `absent` / `half_day` (per policy) | LOP 1 / 0.5 when no leave marker |
| Paid attendance statuses (present, WFH, holiday, etc.) | No LOP |

```text
paid_days = N − LOP
```

## HR → payroll data

`payroll_leave_facts` now includes:

- `is_paid` (from `hr_leave_type`)
- `leave_type_code`, `leave_type_name`

Leave days are expanded to a **per-date map** inside the payroll day engine.

## Run line / preview

`day_summary_json.counts` includes:

- `paid_leave`, `unpaid_leave`, `lop`
- (plus existing present/absent/scheduled_working/…)

Preview:

```http
GET /payroll/payroll-periods/{id}/employee-day-ledger?employee_id={uuid}
```

Proration runs when there is **attendance and/or approved leave** in the period.

## Next (Phase 4)

Company salary structure (60/50) + fixed ₹3,700 PF in `PayrollRunEngine`.
