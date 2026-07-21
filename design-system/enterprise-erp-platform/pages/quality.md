# Quality Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Quality management workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + quality workspace (page header → KPI strip → inspection funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for inspections / NCRs / CAPAs
- **Do not** use marketing hero, feature-showcase, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: accepted/approved/verified/closed green · draft/pending/in_progress/investigating amber · rejected/critical/cancelled red
- Severity: minor slate · major amber · critical red (text labels, not color alone)
- No purple gradients; no oversized display type

### Component Overrides

- KPI strip: open inspections, open NCRs, open CAPAs, critical defects
- Secondary nav: Overview · Incoming · In-Process · Final · NCRs · CAPAs · Audits · Complaints
- Lifecycle funnel: Incoming → In-Process → Final → NCR → CAPA
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, NCRs, CAPAs)
2. KPI strip (live API aggregates)
3. Quality funnel
4. Quick links + workspace resource groups
5. Recent inspections + NCR watch + severity mix

### Avoid

- Dark-mode-by-default
- Fashion/editorial typography
- Emoji icons, marketing CTAs, pill clusters
