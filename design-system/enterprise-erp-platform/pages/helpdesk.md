# Helpdesk Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Helpdesk / customer support workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + helpdesk workspace (page header → KPI strip → support funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for tickets / escalations / knowledge / feedback
- **Do not** use FAQ/docs marketing heroes, Cormorant/serif shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: resolved/closed/completed/published/active green · draft/new/assigned/pending/in_progress amber · cancelled/breached/expired red
- Ticket status mix: cool progressive tones
- No purple gradients; no academia/parchment themes

### Component Overrides

- KPI strip: open tickets, active assignments, open escalations, published articles
- Secondary nav: Overview · Tickets · Assignments · Escalations · Knowledge · Resolutions · Teams · Feedback
- Lifecycle funnel: Ticket → Assignment → Escalation → Resolution → Article → Feedback
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Tickets, Escalations)
2. KPI strip (live API aggregates)
3. Support funnel
4. Quick links + workspace resource groups
5. Recent tickets + escalation watch + ticket status mix

### Avoid

- Dark-mode-by-default
- FAQ/documentation marketing layouts
- Emoji icons, marketing CTAs, pill clusters
