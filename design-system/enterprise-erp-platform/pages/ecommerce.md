# Ecommerce Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** E-Commerce / External Channel workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + ecommerce workspace (page header → KPI strip → commerce funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for orders / payments / shipments / returns
- **Do not** use consumer storefront marketing heroes, Cormorant/serif shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: active/captured/shipped/delivered/open green · draft/processing/requested/packed amber · cancelled/failed/returned red
- Channel type mix: cool progressive tones
- No purple gradients; no academia/parchment themes

### Component Overrides

- KPI strip: active stores, open carts, processing orders, shipments
- Secondary nav: Overview · Stores · Listings · Carts · Orders · Payments · Shipments · Returns
- Commerce funnel: Listing → Cart → Order → Payment → Shipment → Return (FRD-22 / ERD_22)
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Orders, Shipments)
2. KPI strip (live API aggregates)
3. Commerce funnel
4. Quick links + workspace resource groups
5. Recent orders + shipment watch + channel type mix

### Avoid

- Dark-mode-by-default
- Consumer marketplace marketing layouts
- Emoji icons, marketing CTAs, pill clusters
