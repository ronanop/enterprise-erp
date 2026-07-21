# Analytics Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** BI / Analytics workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + analytics workspace (page header → KPI strip → BI pipeline funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for dashboards / reports / KPIs / alerts
- **Do not** use SaaS analytics marketing heroes, Cormorant/serif shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: active/published/succeeded/approved green · draft/pending/scheduled amber · failed/error/cancelled red
- Dashboard type mix: cool progressive tones
- No purple gradients; no academia/parchment themes

### Component Overrides

- KPI strip: dashboards, active KPIs, active alerts, reports
- Secondary nav: Overview · Dashboards · Reports · KPIs · Datasets · Metrics · Alerts · Exports
- BI pipeline funnel: Dataset → Metric → KPI → Dashboard → Report → Alert (FRD-18 §3)
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Dashboards, Reports)
2. KPI strip (live API aggregates)
3. BI pipeline funnel
4. Quick links + workspace resource groups
5. Recent dashboards + alert watch + dashboard type mix

### Avoid

- Dark-mode-by-default
- Consumer analytics marketing layouts
- Emoji icons, marketing CTAs, pill clusters
