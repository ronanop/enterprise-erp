# Payroll Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Payroll compensation workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + payroll workspace (page header → KPI strip → pay cycle funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for runs / payslips / loans
- **Do not** use marketing heroes, oversized display type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem (currency)
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: paid/posted/approved/issued green · draft/calculated/submitted/processing amber · void/failed/rejected/overdue red
- Run status mix: cool progressive tones
- No purple gradients

### Component Overrides

- KPI strip: open periods, open runs, unpaid payslips / net pay, active loans
- Secondary nav: Overview · Periods · Salaries · Runs · Payslips · Bonuses · Loans · Summaries
- Lifecycle funnel: Period → Run → Payslip → Bonus → Loan
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Runs, Payslips)
2. KPI strip (live API aggregates)
3. Payroll funnel
4. Quick links + workspace resource groups
5. Recent runs + payslip watch + run status mix

### Avoid

- Dark-mode-by-default
- Fashion/editorial typography
- Emoji icons, marketing CTAs, pill clusters
