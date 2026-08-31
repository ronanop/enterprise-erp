# Phase 6 — Leave accrual schedule, bank export, ESS payslips

## Goals

1. **Leave balance timing** — Monthly credit uses the same idempotent path as `hr.leave_balance_accrual` (`last_accrual_yyyymm` + completed calendar month).
2. **Bank export** — CSV for NEFT upload from a calculated payroll run.
3. **ESS payslips** — Employees see **issued** payslips only, with period labels and breakdown from `payslip_json`.

## Leave accrual

| Task | When | Behaviour |
|------|------|-----------|
| `hr.leave_balance_accrual` | Manual / optional | Credits last completed calendar month (`completed_calendar_month_yyyymm`). |
| `hr.leave_balance_monthly_credit` | Celery beat: **1st of month, 02:30 UTC** | Runs `LeaveBalanceService.run_monthly_accrual_all_tenants`, then in-app notifications for balances credited in that period. |

Payroll **20–20** cycle is unchanged; leave accrual stays on **calendar 1–31**.

## Bank export

```http
GET /payroll/payroll-runs/{run_id}/bank-export
```

Response:

```json
{ "csv": "employee_code,employee_name,...", "content_type": "text/csv" }
```

Rows use `pay_payroll_run_line.net_pay` (or payslip net), bank fields from `hr.hr_employee_profile`.

Web helper: `fetchPayrollRunBankExportCsv(runId)` in `payroll-management-service.ts`.

## ESS

| Endpoint | Notes |
|----------|--------|
| `GET /ess/payslips` | Only `status=issued` for the logged-in employee. |
| `GET /ess/payslips/{id}` | Adds `period_name`, `export_text`, `earnings`, `deductions`, `attendance_summary`. |
| `GET /ess/payslips/{id}/export-text` | Plain-text payslip (same as Phase 5 export). |

Employee app payslip detail reads API breakdown when present (60/40-style splits from policy payslip JSON).

## QA checklist

1. Issue payslips for a run (`POST .../generate-payslips` with `issue: true`).
2. Employee ESS lists the payslip; detail shows correct Basic/HRA/Special and LOP stats.
3. `GET .../bank-export` returns CSV with sanitized account numbers and net amounts.
4. (Optional) Trigger `hr.leave_balance_monthly_credit.delay()` twice for same month — second run should not double-credit.

## Related docs

- Phase 5: `PHASE5-PAYSLIP.md`
- Phase 1 leave calendar: `PHASE1-PERIODS.md`
