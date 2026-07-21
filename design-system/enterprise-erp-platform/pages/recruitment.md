# Recruitment Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Recruitment ATS workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + recruitment workspace (page header → KPI strip → hire funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for requisitions / candidates / interviews / offers
- **Do not** use marketing heroes, exaggerated display type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: hired/accepted/cleared/filled/published green · draft/screening/interview/sent/scheduled amber · rejected/withdrawn/failed/blacklisted red
- Application stage mix: cool progressive tones
- No purple gradients

### Component Overrides

- KPI strip: open requisitions, pipeline applications, scheduled interviews, open offers
- Secondary nav: Overview · Requisitions · Postings · Candidates · Applications · Interviews · Offers · Onboarding
- Lifecycle funnel: Requisition → Posting → Application → Interview → Offer → Onboarding
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Candidates, Interviews)
2. KPI strip (live API aggregates)
3. Hiring funnel
4. Quick links + workspace resource groups
5. Recent applications + interview watch + application status mix

### Avoid

- Dark-mode-by-default
- Fashion/editorial / job-board marketing typography
- Emoji icons, marketing CTAs, pill clusters
