# Asset Reports Page Overrides

> **PROJECT:** Enterprise ERP Platform  
> **Page Type:** Asset analytics / reporting workspace  
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** Page header → analytics KPI strip (Documents, Components, Usage, Lifecycle) → status charts → documents/components charts → lifecycle + usage → registration trend
- **Max Width:** Full assets workspace
- **Do not** duplicate operational Dashboard KPIs (active assets, open maintenance, book value, disposal queues)

### Content Focus (distinct from Dashboard)

- Documents: coverage %, by type, assets with/without files
- Components: totals, by type/status
- Asset status + operational status mix
- Assignment usage / utilization
- Lifecycle funnel (Registered → Assigned → Maintenance → Depreciating → Disposed)
- Registration trend (6 months)

### Charts

- Bar: status mix, document types, component types, lifecycle stages
- Donut/pie: operational status, assignment usage (≤5 slices; legend + tooltip)
- Line: registration trend
- Palette: sky / teal / emerald / amber / slate / rose — no purple

### Spacing / Density

- High density; card padding `p-4`–`p-5`; chart height ~288px (`h-72`)
- Responsive: 1-col → 2-col → 12-col grid at `xl`

### Avoid

- Duplicate Dashboard health/category cards as primary content
- Dark-mode-by-default, emoji icons, purple gradients
