# DC Challan Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** Asset operations register (authenticated app)
> Rules in this file **override** `MASTER.md` and `pages/assets.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** Page header → clickable KPI strip → search + **filter popover + chips** (inventory pattern, not an always-open filter card) → dense table → sectioned detail drawer
- **Drawer sections:** Asset · Employee (code for directory; deployed-to instead of code for manual-entry) · Timeline · Documents (stored PDF/JPEG/PNG with View / Download / Print; no URL paste)
- Manual SCM upload is labelled as a fallback until SCM is connected
- Uploading the signed copy also marks the challan signed — there is no separate Mark Signed action
- Replace document (IT `:receive` only) asks for confirmation; the previous file remains in audit history
- Print opens the document itself (hidden iframe), not the workspace page
- **Bulk bar:** Select pending rows → Send to SCM; show per-item skip reasons

### Spacing Overrides

- Match inventory density: table rows ~36px, KPI `p-3`, chip row `gap-2`

### Color Overrides

- Use `statusColorMap.dcChallan` only: Pending slate · Sent to SCM sky · Document received amber · Signed teal · Received emerald · Cancelled zinc
- Phone-missing warning is amber text, not a blocking error (directory employees). Manual-entry challans use the same amber pattern for blank **email**; phone is required for send

### Component Overrides

- StatCards filter the list on click
- Create DC is employee-only when launched from an assignment; Case 2 (asset, no assignment) remains allowed
- Create modal uses searchable asset typeahead (Ready to Move / Assigned only) plus an assignment confirm chip — never raw UUIDs
- Deep links from inventory/assignment skip the picker and show a read-only confirmation preview
- No purple/pink gradients; Lucide icons only
