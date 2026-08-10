# Projects Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Site installation delivery workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + projects workspace (page header → site KPIs → delivery pipeline → recent/attention panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** Dense KPI strip; stage funnel; site tables
- **Do not** use portfolio marketing heroes, Archivo/Space Grotesk shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter / system app font)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate
- Status: completed green · draft/submitted/in_progress amber · cancelled/on_hold red
- No purple gradients; no oversized display type

### Component Overrides

- Dashboard focus: **site installation delivery** (not generic WBS / timesheets / budget burn)
- KPI strip: total sites, in delivery, need owners, completed + stage queues
- Secondary nav: Dashboard · Projects · All Sites · Delivery stages
- Pipeline: Intake → Assign → Survey → SCM → Installation & Configuration → Acceptance → Completed
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, New Site Request, All Sites)
2. Headline band (total / in delivery / need owners / completed)
3. Stage KPI cards (Survey, SCM, Installation, Acceptance)
4. Delivery pipeline + delivery scope mix
5. Recent sites + needs attention
6. Quick stage tiles

### Avoid

- Portfolio value / hours logged / timesheet approval as primary dashboard metrics
- Task board / budget category as primary navigation from dashboard
- Dark-mode-by-default
- Emoji icons, marketing CTAs, pill clusters
