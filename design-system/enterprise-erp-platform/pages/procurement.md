# Procurement Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Procurement procure-to-pay workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + procurement workspace (page header → KPI strip → lifecycle funnel → workspace groups → recent docs)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel stages; dense tables for PRs/POs/GRNs/invoices
- **Do not** use marketing hero, 3D configurator, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: slate → sky → teal → emerald with conversion % as text
- Status: approved/received/posted green · draft/submitted/open amber · rejected/cancelled red
- Vendor score: red &lt;60 · amber 60–79 · green ≥80
- No purple gradients; no oversized display type

### Component Overrides

- KPI strip: open PRs, open POs, AP outstanding, avg vendor score
- Secondary nav: Overview · Requisitions · RFQs · Orders · GRNs · Invoices · Contracts · Performance
- Lifecycle funnel: Requisition → RFQ → PO → GRN → Invoice (counts + conversion %)
- Prefer Lucide; sticky headers; row hover without layout shift

### Section Order

1. Page header + actions (Refresh, POs, Invoices)
2. KPI strip (live API aggregates)
3. Procure-to-pay funnel
4. Quick links + workspace resource groups
5. Recent POs + requisitions + vendor performance

### Avoid

- Dark-mode-by-default
- Fashion/editorial typography
- Emoji icons, marketing CTAs, pill clusters
