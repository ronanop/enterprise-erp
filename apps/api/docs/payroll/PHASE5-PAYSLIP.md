# Payroll Phase 5 — Payslips & export

## Generate payslips from a payroll run

After **Calculate** (status not `draft`):

```http
POST /payroll/payroll-runs/{run_id}/generate-payslips
{ "issue": true }
```

- Builds **`payslip_json`** via `payslip_document_builder` (earnings, PF, attendance block, day summary).
- Upserts one payslip per run line (`payroll_run_line_id` unique).
- Optional **`issue: true`** marks payslips issued.

## Plain-text export

```http
GET /payroll/payslips/{id}/export-text
```

Returns `{ "text": "..." }` — same layout stored in `payslip_json.export_text`.

## Web HR payroll UI

`generatePayslips(runId)` calls **`generate-payslips`** first; downloads use **`exportPayslipText`** when `exportText` is present.

## Payslip document sections

| Section | Content |
|---------|---------|
| `period` | 20–20 dates, code, name |
| `attendance` | N, paid days, LOP, leave, paid/unpaid leave |
| `earnings` | Basic, HRA, Special, OT, bonus |
| `deductions` | EE/ER PF, adjustments |
| `summary` | Gross, net, employer cost |

## Tests

```bash
pytest src/tests/unit/payroll/test_payslip_document_builder.py -q
```

## Rollout checklist

1. `POST /payroll/policies/ensure-default`
2. `POST /payroll/payroll-periods/generate`
3. Create run → **calculate** → **generate-payslips**
4. Verify sample ₹30,000 → net ₹26,300 on payslip text
