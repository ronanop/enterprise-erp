# App Shell Page Overrides

> **PROJECT:** iConnect Plus
> **Page Type:** Application shell (sidebar + topbar + workspace)

> Rules in this file **override** `MASTER.md`. Only deviations are listed here.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** Fixed/collapsible sidebar + sticky topbar + scrollable main content
- **Max Width:** Full-width workspace (no marketing max-width constraint)
- **Grid:** 12-column for dashboards; fluid for list/detail pages
- **Sidebar width:** 260px expanded / 72px collapsed icon rail
- **Header height:** ~56px

### Spacing Overrides

- **Content Density:** High - optimize for information display
- Use dense tokens from MASTER (`--space-md` / `--space-lg` for cards and tables)
- Table row height ~36px; card padding ~12px; grid gap ~8px

### Typography Overrides

- Body/UI: 12-14px for dense tables and sidebars
- Page titles: clear hierarchy, not oversized display type
- No clamp(3rem-12rem) hero typography inside the app shell

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

---

## Collapse Motion (Figma)

**File:** [iConnect Plus — Sidebar Collapse](https://www.figma.com/design/YYC06qVSLGCCbWTijOohO6)

| State | Width |
|-------|-------|
| Expanded | 260px |
| Collapsed | 72px (icon rail) |

### Sequence

1. Labels / account text fade (160ms) — never hard-cut mid-glyph
2. Search height collapses (220ms)
3. Rail width 260 ↔ 72 (320ms, `cubic-bezier(0.32, 0.72, 0, 1)`)
4. Icons stay left-aligned and visible in the 72px rail
5. Page layout spacer updates once at click so charts resize once, not per frame

### Collapsed icon rail

**Figma:** [Collapsed Icon Rail Spec](https://www.figma.com/design/YYC06qVSLGCCbWTijOohO6)

- Flat list (no section title gaps)
- **40×40** circular hit targets, **10px** equal gap (`gap-2.5`)
- Idle: `bg-white/8`; Active: sidebar accent + primary glyph
- Centered in 72px rail

### Avoid

- `clip-path` only “cut” (no fade / width choreography)
- Width-driven chart redraw every animation frame
- Uneven group margins when collapsed
