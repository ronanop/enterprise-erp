# Service Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Field service / FSM workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + service workspace (page header → KPI strip → delivery funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for requests / tickets / work orders / visits
- **Do not** use FAQ/docs marketing heroes, Outfit/Work Sans shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: resolved/closed/completed/approved/active green · draft/open/pending/in_progress/scheduled amber · cancelled/blocked/breached/expired red
- Ticket status mix: cool progressive tones
- No purple gradients; no green marketing backgrounds

### Component Overrides

- KPI strip: open requests, open tickets, open work orders, open escalations
- Secondary nav: Overview · Requests · Tickets · Work Orders · Visits · SLAs · Escalations · Contracts
- Lifecycle funnel: Request → Ticket → Assignment → Work Order → Visit → Contract
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Tickets, Work Orders)
2. KPI strip (live API aggregates)
3. Service delivery funnel
4. Quick links + workspace resource groups
5. Recent requests + work-order watch + ticket status mix

### Avoid

- Dark-mode-by-default
- Support-center / FAQ marketing layouts
- Emoji icons, marketing CTAs, pill clusters
