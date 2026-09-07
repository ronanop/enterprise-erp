# Leave Adjust Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** HRMS attendance / payroll leave-adjust workspace
> Rules in this file **override** `MASTER.md` for this page only.

---

## Page-Specific Rules

### Placement

- Primary: Attendance Management underline tab **Leave adjust** at `/hr/time?tab=leave-adjust`
- Secondary: Payroll run **Leave adjust** tab and employee payroll page
- Do not add a sidebar nav item. Do not reopen Apply Leave or Mark Attendance for this flow.

### Layout

- Dense tables; light content pane; Swiss / data-dense tokens from the live HRMS shell (not MASTER rose)
- Filter row: **Month** or **Custom** date range (optional Pay cycle 20–19) + searchable employee by **name and code**
- Balance strip: CL / SL / EL remaining; present days; not present days
- Days table: date, **Present / Not present**, punch, leave (if already applied)
- History table on the same tab when any past adjust exists

### Behavior copy (short)

- Auto-adjust is off. Paid leave is taken when the **employee applies**, or when HR records it later.
- This tab is for reviewing presence. Locked payroll run / month stays read-only.

### Avoid

- Emoji icons
- Dark-mode-by-default
- AI purple/pink gradients
- Hero / KPI marketing cards
