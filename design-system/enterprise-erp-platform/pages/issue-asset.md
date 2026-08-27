# Issue Asset Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Asset issue form (authenticated app)
> Rules in this file **override** `MASTER.md` and `pages/assets.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** Single scrollable page — not a gated wizard. Header (title + branch) → optional section jump nav (desktop) → stacked section cards → sticky footer
- **Sections in order:** Allocation & Employee · Asset · Issued Items · Delivery (DC paperwork) · Review & Submit
- Each section is its own card (`rounded-xl`, `p-5`/`p-6`, `space-y-8` between cards). Do not collapse this back into step cards with Next/Back
- **Max width of fields:** `max-w-xl` inside sections; page uses full workspace width
- Sidebar jump links are in-page anchors only — never disabled, never step-gated
- Mobile: jump nav hidden; sections stack; no horizontal overflow

### Spacing Overrides

- More generous than inventory tables: section gap `2rem` (`space-y-8`), card padding `1.25–1.5rem`
- Footer is sticky with a top border; Cancel left, Save draft + Submit right

### Typography Overrides

- Page title: `text-lg font-semibold tracking-tight` (same as other asset workspaces)
- Section titles: `text-sm font-semibold tracking-tight` (not 11px uppercase — these are form sections, not drawer kv blocks)
- Section descriptions: `text-xs` muted
- Missing-fields summary: `text-xs` muted, listed explicitly — never a silent disabled Submit

### Color Overrides

- Reuse existing asset `statusColorMap` / drawer card tokens
- Validation errors: `--color-destructive` text under the field
- No new palette; no purple/pink; light shell only

### Component Overrides

- Employee allocation has a directory / manual-entry toggle (same button-mode pattern as DC delivery modes)
- Delivery modes keep Handle later as the default visual selection
- Save draft persists the full current form via the existing assignment draft create/update endpoints
- Submit is disabled until required fields across all sections are valid, with a visible missing-field list
