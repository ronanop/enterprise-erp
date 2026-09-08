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
| `/marketing/operations` | Campaign health, delays, utilization |
| `/marketing/my-work` | Individual tasks |
| `/marketing/tasks` | Nested task execution / delegation |
| `/marketing/m365` | Teams / SharePoint / OneDrive |
| `/marketing/workload` | Resource balancing |
| `/marketing/campaigns` | Campaign list. Open a row for the campaign home |
| `/marketing/campaigns/[id]` | Campaign home — brief, captions, approvals, calendar, tasks, assets |
| `/marketing/inbox` | Reply queue for live published posts |
| `/marketing/content` | Content studio — requests + generated drafts |
| `/marketing/research` | Research & trends |
| `/marketing/brand-voices` | Brand kit — logo, colors, fonts, voice |
| `/marketing/calendar` | Publishing calendar — **month grid** (not list table) |
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
