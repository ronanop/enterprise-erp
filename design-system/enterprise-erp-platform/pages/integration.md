# Integration Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Integration Hub workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + integration workspace (page header → KPI strip → connectivity funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for systems / connectors / sync / DLQ
- **Do not** use developer-portal marketing heroes, dark-mode-by-default, or Cormorant/serif shouty type

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell (never code-dark background)
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: active/succeeded/approved green · draft/pending/running amber · failed/dead_letter/cancelled red
- System type mix: cool progressive tones
- No purple gradients; no academia/parchment themes

### Component Overrides

- KPI strip: active systems, active connectors, active webhooks, sync jobs
- Secondary nav: Overview · Systems · Connectors · Webhooks · Events · Queues · Sync · Dead Letters
- Connectivity funnel: System → Connector → Webhook → Event → Queue → Sync (FRD-21 §3 / ERD_21)
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Systems, Sync Jobs)
2. KPI strip (live API aggregates)
3. Connectivity funnel
4. Quick links + workspace resource groups
5. Recent systems + sync watch + system type mix

### Avoid

- Dark-mode-by-default / terminal aesthetic as shell
- API marketplace marketing layouts
- Emoji icons, marketing CTAs, pill clusters
