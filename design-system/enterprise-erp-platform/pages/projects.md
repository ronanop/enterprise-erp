# Projects Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Project management PMO workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + projects workspace (page header → KPI strip → delivery funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for projects / tasks / timesheets / risks
- **Do not** use portfolio marketing heroes, Archivo/Space Grotesk shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem (currency / hours)
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: completed/achieved/approved/posted/resolved green · draft/planned/submitted/in_progress amber · blocked/delayed/rejected/cancelled/on_hold red
- Project status mix: cool progressive tones
- No purple gradients; no oversized display type

### Component Overrides

- KPI strip: active projects, open tasks, pending timesheets, open issues
- Secondary nav: Overview · Projects · Tasks · Timesheets · Budgets · Issues · Risks · Changes
- Lifecycle funnel: Project → Phase → Milestone → Task → Timesheet → Budget
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Tasks, Timesheets)
2. KPI strip (live API aggregates)
3. Delivery funnel
4. Quick links + workspace resource groups
5. Recent projects + task watch + project status mix

### Avoid

- Dark-mode-by-default
- Creative portfolio / agency masonry layouts
- Emoji icons, marketing CTAs, pill clusters
