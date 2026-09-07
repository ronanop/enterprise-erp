# Payroll Run Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** HRMS payroll run workspace
> Rules in this file **override** `MASTER.md` and extend `pages/hr-payroll.md`.

---

## Page-Specific Rules

### Layout

- **Run payroll** lives on `/hr/payroll?section=run-payroll` as a same-tab drill-down (not a wizard drawer).
- Three clickable levels: **Months** → **Employees** → **Pay**.
- Dense tables; light pane; no KPI heroes; no dark-mode-by-default.
- Entire row is `cursor-pointer` with 150–300ms hover.

### Months

- One row per month. Columns: Month, Employees, Gross, Deductions, Net, Status, Lock.
- Click a month to open employees.
- **Generate payroll** on this screen: pick month, show cycle dates, confirm. Updates the same month.

### Employees

- Columns: Name, Present, Leave, Weekly off, Loss of pay, Payable, Gross, Deductions, Net.
- Click a name to open pay.
- Lock stays on the header.

### Pay

- Earnings and deductions tables plus net.
- Leave adjust for that employee.
- Back returns to employees, then months.

### Labels

- Use Month, Weekly off, Loss of pay, Pending HR. Do not use Cutover, WO, LOP on the main tables.

### Avoid

- Jumping to `/hr/payroll/runs/new` for generate.
- Right-sidebar run wizard.
- Emoji icons.
