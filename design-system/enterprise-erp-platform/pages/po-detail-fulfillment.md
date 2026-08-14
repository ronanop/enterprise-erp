# PO Detail Fulfillment Charts

> **PROJECT:** Enterprise ERP Platform
> **Page:** Purchase order detail — fulfillment overview
> Overrides MASTER only where noted.

---

## Purpose

Per-PO visualization of ordered qty, GRN received, pending receipt, billed, and unbilled (stock).

## Chart Rules

- **Receipt progress:** part-to-whole pie — Received (sky `#0369A1`) vs Pending GRN (amber `#F59E0B`)
- **Billing mix:** part-to-whole pie — Billed (emerald `#059669`) vs In stock (teal `#0D9488`)
- Always pair pies with numeric legend + stacked bar fallback (a11y)
- Max 2–3 slices per pie; use MASTER navy/sky/teal — no purple

## Layout

- Place below Purchase order overview on PO view; also at top of GRN workspace
- KPI chips: Ordered · Received · Pending GRN · Billed · In stock
- Density: high dashboard; subtle motion only
