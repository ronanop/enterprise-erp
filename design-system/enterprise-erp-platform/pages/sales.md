# Sales Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Sales order-to-cash workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + sales workspace (page header → KPI strip → lifecycle funnel → workspace groups → recent docs)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel stages; dense tables for quotations/orders/invoices
- **Do not** use marketing hero, Enterprise Gateway, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel stage gaps `8px`
- Compact toolbars; no oversized card padding

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem
- KPI values: tabular numerals ~1.5rem
- Funnel stage labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: single cool gradient (slate → sky → teal) with conversion % as text
- Status: confirmed/delivered/paid green · draft/sent/processing amber · rejected/cancelled/hold red
- Credit hold: destructive badge emphasis
- No purple gradients; no serif/academia fonts

### Component Overrides

- KPI strip: open quotations, open orders, invoice outstanding, credit holds
- Secondary nav: Overview · Quotes · Orders · Deliveries · Invoices · Returns · Pricing · Credit
- Lifecycle funnel: Quotation → Order → Delivery → Invoice → Return (counts + drop-off %)
- Prefer Lucide; sticky headers; row hover without layout shift

### Section Order

1. Page header + actions (Refresh, New Orders, Invoices)
2. KPI strip (live API aggregates)
3. Sales lifecycle funnel
4. Quick links + workspace resource groups
5. Recent orders + quotations + credit watchlist

### Avoid

- Dark-mode-by-default
- Fashion/editorial typography (Cormorant, etc.)
- Oversized display type
- Emoji icons, marketing CTAs, pill clusters
