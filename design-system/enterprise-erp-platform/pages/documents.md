# Documents Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Document Management (DMS) workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + documents workspace (page header → KPI strip → lifecycle funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for documents / approvals / archives
- **Do not** use file-storage marketing heroes, Cormorant/serif shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: published/approved/active/archived green · draft/pending/submitted/in_review amber · rejected/expired/cancelled red
- Classification mix: cool progressive tones
- No purple gradients; no academia/parchment themes

### Component Overrides

- KPI strip: library documents, pending approvals, active shares, archives
- Secondary nav: Overview · Folders · Documents · Versions · Approvals · Templates · Retention · Archives
- Lifecycle funnel: Document → Version → Approval → Share → Retention → Archive (FRD-19 §3)
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Documents, Approvals)
2. KPI strip (live API aggregates)
3. Lifecycle funnel
4. Quick links + workspace resource groups
5. Recent documents + approval queue + classification mix

### Avoid

- Dark-mode-by-default
- Consumer cloud-storage marketing layouts
- Emoji icons, marketing CTAs, pill clusters
