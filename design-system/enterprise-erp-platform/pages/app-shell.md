# App Shell Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Application shell (sidebar + topbar + workspace)

> Rules in this file **override** `MASTER.md`. Only deviations are listed here.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** Fixed/collapsible sidebar + sticky topbar + scrollable main content
- **Max Width:** Full-width workspace (no marketing max-width constraint)
- **Grid:** 12-column for dashboards; fluid for list/detail pages
- **Sidebar width:** ~240px expanded / icon-rail collapsed
- **Header height:** ~56px

### Spacing Overrides

- **Content Density:** High — optimize for information display
- Use dense tokens from MASTER (`--space-md` / `--space-lg` for cards and tables)
- Table row height ~36px; card padding ~12px; grid gap ~8px

### Typography Overrides

- Body/UI: 12–14px for dense tables and sidebars
- Page titles: clear hierarchy, not oversized display type
- No clamp(3rem–12rem) hero typography inside the app shell

### Color Overrides

- Neutral light shell (`#F8FAFC` background, navy primary)
- Status colors for operational states: success green, warning amber, danger red
- Do **not** default to dark mode

### Component Overrides

- Prefer ShadCN primitives (Button, Input, Card, Badge, Separator, Table patterns)
- Interactive surfaces only as cards when interaction requires a container
- Multi-select and bulk actions supported on resource lists
- Icons: Lucide only (no emoji icons)

### Avoid

- Marketing hero sections inside authenticated app routes
- AI purple/pink gradients
- Playful / maximalist decoration
- Layout-shifting hover scales on dense tables
