# Page Override: HR Executive Dashboard

> Overrides `MASTER.md` for `/hr` executive overview only.

**Project:** Enterprise ERP Platform  
**Page:** hr-dashboard  
**Generated:** 2026-07-23

---

## Page Intent

World-class HRMS executive dashboard (SuccessFactors / Workday / Darwinbox style): real-time workforce KPIs, analytics, calendar, approvals, activity, notifications, and role-based views.

## Design Rules (Overrides)

| Token | Value | Notes |
|-------|-------|-------|
| Primary | `#2563EB` | Match MASTER — not darker blue from persist script |
| Accent | `#059669` | Success / present / approved |
| Background | `#F8FAFC` | Light enterprise |
| Foreground | `#0F172A` | High contrast |
| Warning | `#D97706` | Pending approvals |
| Danger | `#DC2626` | Absent / attrition |

**Typography:** Plus Jakarta Sans (MASTER)  
**Density:** High data-dense dashboard  
**Motion:** Subtle 150–300ms; respect `prefers-reduced-motion`  
**Icons:** Lucide only — no emoji  

## Layout

1. Greeting strip (date/time, search, notifications, profile, role switcher)
2. Quick actions row
3. Statistics card grid (15 KPIs)
4. Analytics charts (2-col / responsive)
5. Three-column: Calendar | Approvals | Notifications
6. Activity timeline + Quick reports

## Role Views

| Role | Visibility |
|------|------------|
| HR / Super Admin | Full dashboard |
| Manager | Team attendance, leave, approvals, calendar |
| Employee | Personal attendance, leave, notifications |
| Recruiter | Hiring funnel, jobs, candidates, interviews |
| Finance | Payroll KPIs, cost trend, payroll approvals |

## Anti-Patterns

- No purple/pink gradients
- No dark-mode-by-default
- No emoji icons
- No ornate decorative chrome
