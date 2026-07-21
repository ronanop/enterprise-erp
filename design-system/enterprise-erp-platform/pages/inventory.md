# Inventory Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Inventory & warehouse workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + inventory workspace (page header → KPI strip → stock composition → workspace groups → activity panels)
- **Max Width:** Full workspace (~1400px)
- **Grid:** 12-col for KPIs; dense tables for stock / transfers / valuation
- **Do not** use marketing hero, feature-showcase, candlestick charts, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem
- KPI / qty values: tabular numerals ~1.5rem
- No oversized display type

### Color Overrides

- Keep MASTER light shell
- Stock health: available green · reserved amber · on-hand slate
- Quality hold / expired: destructive red
- Low stock vs reorder point: amber → red
- No purple gradients

### Component Overrides

- KPI strip: on-hand qty, available qty, reserved qty, open transfers
- Secondary nav: Overview · Stock · Bins · Batches · Transfers · Adjustments · Valuation · Reports
- Stock composition bars (on hand / reserved / available) — not a sales funnel
- Reports: tabbed Stock Summary / Batch Expiry
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Stock, Transfers)
2. KPI strip (live API aggregates)
3. Stock composition + open movements
4. Quick links + workspace resource groups
5. Recent transfers + low-stock / valuation watch

### Avoid

- Dark-mode-by-default
- Trading candlestick charts
- Emoji icons, marketing CTAs, pill clusters
