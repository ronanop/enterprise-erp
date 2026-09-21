# Project Tracker Page Overrides

> **PROJECT:** iConnect Plus  
> **Page Type:** Admin in-app spreadsheet workspace

## Page-Specific Rules

### Layout
- Use the light authenticated ERP shell with the standard Projects page maximum width.
- Primary flow is an **in-app Excel-like table editor** (not file upload).
- Keep a compact, horizontally scrollable **Tracker history** table of versioned sheets.
- Open the editor as an inline panel from **New Tracker** or **Open** (revise → new version).

### Density and states
- Dense grid cells (~32px row height), editable column headers, add/remove column and row.
- Disable editor controls while saving; reset project/title/remarks/grid when closed.
- Preserve every saved version. Revising always creates the next version.

### Components
- Header actions: outline Refresh + primary New Tracker (Plus icon).
- Editor: project select, sheet title, optional remarks, spreadsheet toolbar, Save version.
- History: Project, Version, Sheet (col×row), Remarks, Saved, Open + Download.
- Lucide icons only. Muted panels, borders, visible focus, 150–300ms hover transitions.
- No dark mode, gradients, marketing imagery, or oversized headings.
