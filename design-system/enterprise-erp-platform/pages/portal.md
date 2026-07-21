# Portal Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Customer Portal & Self-Service workspace (authenticated app admin)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + portal workspace (page header → KPI strip → self-service funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for accounts / sessions / tickets / views
- **Do not** use consumer portal marketing heroes, Cormorant/serif shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: active/visible/open/recorded green · submitted/pending/draft amber · locked/expired/cancelled/failed red
- Ticket priority mix: cool progressive tones
- No purple gradients; no academia/parchment themes

### Component Overrides

- KPI strip: active accounts, active sessions, open tickets, open service requests
- Secondary nav: Overview · Accounts · Profiles · Sessions · Orders · Invoices · Tickets · Requests
- Self-service funnel: Account → Session → Order View → Invoice View → Ticket → Service Request (ERD_23)
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Accounts, Tickets)
2. KPI strip (live API aggregates)
3. Self-service funnel
4. Quick links + workspace resource groups
5. Recent accounts + ticket watch + ticket priority mix

### Avoid

- Dark-mode-by-default
- Consumer SaaS onboarding marketing layouts
- Emoji icons, marketing CTAs, pill clusters
