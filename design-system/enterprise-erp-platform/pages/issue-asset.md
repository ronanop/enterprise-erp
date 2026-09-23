# Issue Asset Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Asset issue wizard (authenticated app)
> Rules in this file **override** `MASTER.md` and `pages/assets.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** Gated multi-step wizard (one step visible at a time) — progressive disclosure, not a long scroll of all sections
- **Chrome:** Premium atmosphere + surface card; horizontal progress bar; desktop vertical step rail; mobile uses progress + Back/Next only
- **Steps in order:** Allocation & Employee · Asset · Issued Items · Delivery (DC paperwork) · Review & Submit
- **Max width of fields:** `max-w-xl` inside the active step card; page uses full workspace width
- Users may revisit completed/visited steps via the step rail; future steps stay disabled until visited via Next
- Mobile: step rail hidden; no horizontal overflow

### Spacing Overrides

- Single focused step card (`min-h` comfortable, not a vertical train of five cards)
- Asset list: searchable + scrollable panel (`max-h` ~16–20rem) — never unbounded vertical stacks of large cards
- Footer sticky: Cancel left; Back / Save draft / Next|Submit right

### Typography Overrides

- Page title: `text-lg font-semibold tracking-tight`
- Active step title: `text-base font-semibold` inside the step card
- Helper copy: `text-xs` muted
- Step validation / missing-field hints: visible `text-xs` — never a silent disabled Next/Submit

### Color Overrides

- Accent CTA `#0369A1` (Assets premium accent)
- Reuse `statusColorMap` for Ready to Move badges
- Validation errors: destructive under fields
- No purple/pink; light shell only

### Component Overrides

- Employee identification: compact segmented control (Directory / Manual) — not stacked full-width mode cards
- Delivery modes: compact 3-option control (Create now / Link / Later) — default Later
- Asset step: search filter + dense selectable rows in a scroll region
- Save draft available on every step (including review)
- Submit only on final step; disabled until required fields valid, with visible missing list
