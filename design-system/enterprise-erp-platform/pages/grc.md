# GRC Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Governance, Risk & Compliance workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + GRC workspace (page header → KPI strip → lifecycle funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for risks / audits / CAPA / incidents
- **Do not** use compliance marketing heroes, Cormorant/serif shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: approved/active/completed/compliant/closed green · draft/open/planned/pending/submitted amber · critical/overdue/rejected/cancelled red
- Risk level mix: cool progressive tones (low → critical)
- No purple gradients; no academia/parchment themes

### Component Overrides

- KPI strip: open risks, active controls, planned audits, open CAPAs
- Secondary nav: Overview · Policies · Risks · Controls · Compliance · Audits · CAPA · Incidents
- Lifecycle funnel: Risk → Assessment → Control → Compliance → Audit → CAPA (FRD-20 §3)
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Risks, Audits)
2. KPI strip (live API aggregates)
3. Lifecycle funnel
4. Quick links + workspace resource groups
5. Recent risks + CAPA watch + risk level mix

### Avoid

- Dark-mode-by-default
- Legal/compliance marketing layouts
- Emoji icons, marketing CTAs, pill clusters
