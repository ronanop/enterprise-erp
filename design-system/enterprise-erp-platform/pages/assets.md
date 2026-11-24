# Assets Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Fixed-asset lifecycle workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + assets workspace (page header → KPI strip → lifecycle funnel → workspace groups → activity panels)
- **Max Width:** Full workspace (`max-w-none` under AppShell for `/assets`); standalone module nav is a docked full-height sidebar (`72px` collapsed / `260px` expanded) that **pushes** content — never an overlay rail
- **KPI cards:** Clickable — each opens All Assets with matching inventory operational-status preset (`all` / `ready` / `assigned` / `in_use_as_component` / `retired` / `pending_disposal` / `disposed`)
- **Header chrome:** Primary actions only (All assets, Add asset); no Reports header button (reports embed on the dashboard); no placeholder notification/profile controls; no location selector on the IT dashboard
- **Operations layout:** Hero KPI strip (operational status) + quick-actions panel; Ready/Disposal/Assignments queues and Transfer list removed from IT dashboard
- **Surfaces:** Soft atmosphere wash, CRM-rail hero KPI tiles, accent left-rail on quick-actions panel; density remains high
- **Do not** use event/conference heroes, oversized display type, or dark themes

- **Grid:** 12-col for KPIs; dense tables for register / transfers / maintenance / disposal

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
- **Inventory chrome:** Search field + operational-status segmented filter bar (status-colored selected chips; location BranchSelector pattern). Removed advanced Filters popover fields: lifecycle, branch, department, assignment, location. Header location selector remains.

### Section Order

1. Page header + actions (All assets, Add asset)
2. Hero KPI strip (Total / Ready / Assigned / In Use as Component / Disposed)
3. Quick actions panel (Register, Assign, Return, Discovery, Information Portal)

### Avoid

- Dark-mode-by-default
- Event/conference / facility marketing layouts
- Emoji icons, marketing CTAs, pill clusters
