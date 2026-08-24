# Marketing & Social Media — Page Override

> Overrides MASTER only where noted. Otherwise follow `MASTER.md` (Data-Dense Dashboard + Swiss Minimalism).

**Project:** Enterprise ERP Platform  
**Page:** Marketing & Social Media  
**Stack:** Next.js + TypeScript + Tailwind + ShadCN  

## Direction

- Dense operational workspace for campaigns, content studio, calendar, research, and analytics
- Reuse ERP shell tokens (primary slate, accent gold) — **do not** use rose/pink marketing-site palettes
- Lucide icons only; no emoji icons
- High density tables + KPI strip; subtle motion (150–300ms)

## Screens

| Route | Purpose |
|-------|---------|
| `/marketing` | Overview KPIs, pipeline, quick links |
| `/marketing/campaigns` | Marketing campaigns (optional CRM campaign link) |
| `/marketing/content` | Content studio — requests + generated drafts |
| `/marketing/research` | Research & trends |
| `/marketing/brand-voice` | Brand voice training |
| `/marketing/calendar` | Publishing calendar |
| `/marketing/social-accounts` | Connected platforms |
| `/marketing/competitors` | Competitor monitor |
| `/marketing/analytics` | Content performance |

## Components

- Workspace tab nav (same pattern as Documents)
- KPI cards (FinanceKpiCard pattern)
- Status badges for draft / processing / approved / published
- Platform chips (LinkedIn, Instagram, X, etc.) with muted borders

## Checklist

- [ ] cursor-pointer on clickables; 150–300ms hover
- [ ] Focus visible; contrast ≥ 4.5:1
- [ ] prefers-reduced-motion respected
- [ ] Responsive 375 / 768 / 1024 / 1440
