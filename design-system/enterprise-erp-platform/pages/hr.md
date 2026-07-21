# HR / HRMS Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** HRMS workforce workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + HR workspace (page header → KPI strip → workforce funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for employees / leave / attendance
- **Do not** use webinar/marketing heroes, Righteous/Poppins shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: present/active/approved/confirmed green · draft/submitted/probation/pending amber · absent/rejected/missed/ended red
- Attendance mix: present / WFH / half-day / absent as cool-to-warm bars
- No purple gradients; no oversized display type

### Component Overrides

- KPI strip: active employees, pending leave, absent days, open reviews
- Secondary nav: Overview · Profiles · Employment · Attendance · Leave · Performance · Training · Separation
- Lifecycle funnel: Profiles → Employment → Attendance → Leave → Training
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Leave, Attendance)
2. KPI strip (live API aggregates)
3. HRMS funnel
4. Quick links + workspace resource groups
5. Recent leave + attendance mix + pending reviews

### Avoid

- Dark-mode-by-default
- Entertainment/festival typography
- Emoji icons, marketing CTAs, pill clusters
