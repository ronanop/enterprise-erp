# Assets Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Fixed-asset lifecycle workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + assets workspace (page header → KPI strip → lifecycle funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (`max-w-none` under AppShell for `/assets`); standalone module nav is a docked full-height sidebar (`72px` collapsed / `260px` expanded) that **pushes** content — never an overlay rail
- **Operations layout:** Ready to Move + Pending Disposal in 2 columns; Recent Assignments full-width below
- **Grid:** 12-col for KPIs; horizontal funnel; dense tables for register / maintenance / depreciation / disposal
- **Do not** use event/conference heroes, oversized display type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) — KPI `p-3`, table rows ~36px, funnel gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5–1.65rem (Inter)
- KPI values: tabular numerals ~1.5rem (currency)
- Funnel labels: 11–12px uppercase tracking

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate with conversion % as text
- Status: active/approved/posted/completed/returned green · draft/scheduled/in_progress/calculated amber · disposed/written_off/failed/void/expired red
- DC challan: pending slate · sent_to_scm sky · document_received amber · signed teal · received emerald · cancelled zinc
- Asset status mix: cool progressive tones
- No purple gradients; no green marketing backgrounds

### Component Overrides

- KPI strip: active assets, open maintenance, pending depreciation, open disposals
- Secondary nav (current scope): Assets · Configuration · Operations (Assignment, **DC Challan**, Transfers, Maintenance) · Lifecycle (Disposal) · Extended (Components, Documents, QR, Reports)
- Module sidebar: docked, opaque, `bg-sidebar`; collapse toggle (not hover overlay); icons ~16px; row height ~40px
- Lifecycle funnel: Category → Asset → Assignment → Maintenance → Depreciation → Disposal
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables

### Section Order

1. Page header + actions (Refresh, Assets, Maintenance)
2. KPI strip (live API aggregates)
3. Asset lifecycle funnel
4. Quick links + workspace resource groups
5. Recent assets + maintenance watch + asset status mix

### Avoid

- Dark-mode-by-default
- Event/conference / facility marketing layouts
- Emoji icons, marketing CTAs, pill clusters
