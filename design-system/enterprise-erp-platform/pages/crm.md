# CRM Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** CRM sales workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + CRM workspace (page header → KPI strip → lead-to-deal funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for leads / opportunities / tasks
- **Do not** use marketing hero, Anton/loud typography, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: won/qualified/converted/completed green · new/assigned/pending/scheduled amber · lost/unqualified/missed/cancelled red
- Opportunity stage mix: cool progressive tones
- No purple gradients; no oversized display type

### Component Overrides

- KPI strip: open leads, open opportunities, pipeline value, overdue tasks/follow-ups
- Secondary nav: Overview · Leads · Opportunities · Campaigns · Tasks · Follow-ups · Meetings · Feedback
- Lifecycle funnel: Lead → Opportunity → Task → Follow-up → Meeting
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Leads, Opportunities)
2. KPI strip (live API aggregates)
3. CRM funnel
4. Quick links + workspace resource groups
5. Recent leads + opportunity watch + stage mix

### Avoid

- Dark-mode-by-default
- Fashion/editorial / Gen-Z shouty typography
- Emoji icons, marketing CTAs, pill clusters
