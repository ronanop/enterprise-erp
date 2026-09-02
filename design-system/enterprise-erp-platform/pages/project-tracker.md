# Project Tracker Page Overrides

> **PROJECT:** Enterprise ERP Platform  
> **Page Type:** Admin upload and version-history workspace

## Page-Specific Rules

### Layout
- Use the light authenticated ERP shell with the standard Projects page maximum width.
- Keep the main page as a compact, horizontally scrollable history table only.
- Open upload as a modal (`ConfirmDialog`) from a header **New Tracker** action — do not embed the form as a permanent panel above the table.

### Density and states
- Use dense controls and ~36px table rows.
- Make the upload state explicit and disable dialog controls while the file is being sent.
- Reset project, file, and remarks when the dialog closes.
- Show a concise empty state and preserve every uploaded version.

### Components
- Header actions: outline Refresh + primary New Tracker (Plus icon).
- Dialog: project select, Choose-file control (hidden native input), optional remarks, Cancel / Upload tracker.
- Use Lucide file/upload/download icons only.
- Use standard muted panels, borders, visible focus rings, and 150–300ms hover transitions.
- Keep the primary upload action navy/blue; do not use dark mode, gradients, marketing imagery, or oversized headings.
