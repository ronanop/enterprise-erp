# Hr Dashboard Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Generated:** 2026-07-28 10:45:16
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1400px or full-width
- **Grid:** 12-column grid for data flexibility
- **Sections:** 1. Hero (product + live preview or status), 2. Key metrics/indicators, 3. How it works, 4. CTA (Start trial / Contact)

### Spacing Overrides

- **Content Density:** High — optimize for information display

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Dark or neutral. Status colors (green/amber/red). Data-dense but scannable.

### Component Overrides

- Avoid: Single row actions only
- Avoid: Auto-play high-res video loops

---

## Page-Specific Components

- Premium analytics charts (Recharts): donut/pie, area trends, horizontal bars, hiring funnel
- Chart palette: teal / cyan / blue / amber / red (no purple-pink AI gradients)
- Tooltips + % legends for accessibility; `motion-safe` fade-in respects reduced motion
- Funnel shows stage conversion % between steps

## Recommendations

- Effects: Hover tooltips, row highlighting on hover, smooth 150–200ms transitions
- Charts: Donut for part-to-whole (≤5 categories); Area for trends; Funnel for hiring pipeline
- CTA Placement: Primary CTA in nav + After metrics
