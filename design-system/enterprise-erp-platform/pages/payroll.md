# Payroll Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** HRMS payroll workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** HR sidebar dropdown + right content pane (no KPI dashboard)
- Payroll parent expands like Org Setup; each child loads `/hr/payroll?section=`
- **Max Width:** Full workspace
- Dense tables; no marketing heroes, oversized display type, or dark themes

### Sidebar items (order)

1. Salary structure
2. Assign salary
3. Run payroll (includes Month lock)
4. Payslip
5. Revised salary
6. Incentives
7. Salary configuration (includes sandwich and provident fund)

### Removed from this workspace

- Dashboard KPI cards
- Reimbursements
- Loans
- Standalone Month Lock / Approvals / Reports / Audit tabs
- Structure form: Food, Internet, TDS, PT, ESI, loan, advance, insurance (payroll-run items, not CTC template)

### Payslip

- Full-width list (no right-side preview pane)
- Filters: Month or Custom date range, plus employee name/code search
- Columns: employee code, name, month, net pay
- Actions: View (letterhead drawer) and Download PDF (Cache logo + entity name/address)

### Run payroll

- Create and view open **full pages** (`/hr/payroll/runs/new`, `/hr/payroll/runs/[id]`), not a right drawer
- List has no run ID; month filter; clickable rows; lock is an icon action
- Employee payroll detail: `/hr/payroll/runs/[id]/employees/[employeeId]`

### Salary structure builder

- Create and edit open a **full-page form** (`/hr/payroll/salary-structures/new` and `/hr/payroll/salary-structures/[id]`), not a right drawer
- Gross CTC (Excel G) is the primary input; Monthly CTC = Gross CTC
- Editable formulas: Basic % of CTC (default 60%), HRA % of Basic (default 50%), telephone, employer contribution, PF/ESI/EDLI rates
- Computed and saved: Basic, HRA, Special allowance (residual), CTC
- Live sample-month preview (PF, ESI, TDS) is display-only and does not run payroll
- Persist formula inputs and computed amounts on the salary structure record

### Spacing Overrides

- **Content Density:** Very high (9/10) — table rows ~36px

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- Table amounts: tabular numerals

### Color Overrides

- Keep MASTER light shell for the content pane (sidebar remains HR dark shell)
- Status: paid/posted/approved green · draft/processing amber · void/failed red
- No purple/pink gradients on the content pane

### Avoid

- Dark-mode-by-default on the right pane
- Emoji icons
- Card-grid dashboard on Payroll landing
