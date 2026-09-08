# Marketing Calendar — Page Override

> Overrides MASTER only where noted. Otherwise follow `MASTER.md` and `pages/marketing.md`.

**Project:** Enterprise ERP Platform  
**Page:** `/marketing/calendar`  
**Stack:** Next.js + TypeScript + Tailwind + ShadCN  

## Direction

- Dense **month grid** publishing calendar (not a list/table of raw API rows)
- Swiss Minimalism + Data-Dense Dashboard — reuse ERP shell tokens
- Calendar blue accents via existing primary; status via muted badges (planned / scheduled / published / cancelled)
- Lucide icons only

## Layout

1. Page header + refresh + “Schedule” CTA
2. Month navigator (prev / today / next)
3. 7-column month grid (Sun–Sat); day cells with stacked event chips
4. Optional side panel or inline form for create / day detail

## Interaction

- Click day → focus that day / prefill schedule date
- Click event chip → show detail (title, time, status, notes)
- `cursor-pointer` on nav, days, chips, CTAs; 150–300ms hover
- Respect `prefers-reduced-motion`

## Checklist

- [ ] No ResourceListView / “RESULT” table for this route
- [ ] Empty month still shows full grid (not “No records”)
- [ ] Responsive: stack form below grid on &lt;768px
