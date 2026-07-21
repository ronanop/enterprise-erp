# Manufacturing Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Manufacturing production workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + manufacturing workspace (page header → KPI strip → production funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for orders / WIP / scrap
- **Do not** use marketing hero, feature-showcase, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: slate → sky → teal → emerald with conversion % as text
- Status: released/completed/running green · draft/planned/in_progress amber · scrap/halted/cancelled red
- WIP cost bars: material / labor / overhead as distinct cool tones
- No purple gradients; no oversized display type

### Component Overrides

- KPI strip: open POs, WIP value, scrap qty, idle machines
- Secondary nav: Overview · BOMs · Orders · Issues · Receipts · WIP · Scrap · Machines
- Lifecycle funnel: Order → Issue → WIP → Receipt → Scrap
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Orders, WIP)
2. KPI strip (live API aggregates)
3. Production funnel
4. Quick links + workspace resource groups
5. Recent orders + scrap watch + WIP cost breakdown

### Avoid

- Dark-mode-by-default
- Fashion/editorial typography
- Emoji icons, marketing CTAs, pill clusters
