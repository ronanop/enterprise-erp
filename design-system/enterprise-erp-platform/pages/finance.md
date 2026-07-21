# Finance Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Finance & Accounting workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + finance workspace (page header → KPI strip → grouped resources → activity panels)
- **Max Width:** Full workspace width (same as app shell, ~1400px content)
- **Grid:** 12-col for KPI + workspace cards; fluid tables for journals / reports
- **Do not** use marketing hero, Enterprise Gateway, or dark OLED themes on this page

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI cards `p-3`, table rows ~36px, section gaps `16–24px`
- Prefer compact toolbars over large card padding

### Typography Overrides

- Page title: medium weight, ~1.5–1.65rem (not display/hero type)
- KPI values: tabular numerals, medium weight, ~1.5rem
- Table body: 12–13px; headers uppercase tracking for scanability

### Color Overrides

- Keep MASTER light shell (`#F8FAFC` / existing theme tokens)
- Status: posted/open success green · draft/pending amber · overdue/closed/error red
- Aging buckets: cool slate → amber → orange → red as age increases
- Accent CTA remains sky/navy (`#0369A1` / theme primary) — no purple gradients

### Component Overrides

- KPI strip: 4 compact metric tiles (journals, AR, AP, open periods)
- Workspace nav: grouped resource links (Ledger, AR/AP, Fiscal, Tax/FX, Reports)
- Reports: tabbed Trial Balance / AR Aging / AP Aging (not a marketing chart wall)
- Prefer Lucide icons; sticky table headers; row hover without layout shift

### Section Order

1. Page header + primary actions (Refresh, Journals, Trial Balance)
2. KPI strip (live API aggregates)
3. Workspace resource groups
4. Recent journals + period closing status
5. Aging summary (bullet-style bars)

### Avoid

- Dark-mode-by-default
- Oversized typography / fashion minimalism
- Candlestick / trading charts (wrong context for ERP GL)
- Emoji icons, pill clusters, marketing CTAs
