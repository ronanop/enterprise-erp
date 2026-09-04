# Payroll Run Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** HRMS payroll run workspace
> Rules in this file **override** `MASTER.md` and extend `pages/payroll.md`.

---

## Page-Specific Rules

### Layout Overrides

- **Run payroll list** stays at `/hr/payroll?section=run-payroll`
- **New run** and **run detail** are **full pages**, not right drawers:
  - `/hr/payroll/runs/new`
  - `/hr/payroll/runs/[runId]`
  - `/hr/payroll/runs/[runId]/employees/[employeeId]`
- Dense tables; light content pane; no KPI cards, heroes, or dark-mode-by-default

### List

- Columns: Pay cycle, Employees, Gross, Deductions, Net, Status, Lock
- No run ID / document number column
- Month filter required
- Entire row opens the run page
- No instructional / “how payroll works” copy

### New run / detail

- Month selector, then a full employee table (name, attendance, salary)
- Click an employee for earnings / deductions / net
- Lock is a row/header icon: locked runs stay clickable (view)
- Locked months cannot be generated again; other months can

### Avoid

- Right-sidebar run wizard
- Helper paragraphs about proration, snapshots, or month-lock policy
- Emoji icons
