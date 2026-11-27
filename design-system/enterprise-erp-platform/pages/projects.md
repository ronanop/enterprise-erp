# Projects Page Overrides

> **PROJECT:** iConnect Plus
> **Page Type:** Site installation delivery workspace (authenticated app)
> Rules in this file **override** `MASTER.md`. Only deviations are listed.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + projects workspace (page header → headline band → delivery flow → stage KPIs → charts → recent/attention)
- **Max Width:** Full workspace (~1400px)
- **Grid:** Dense KPI strip; horizontal stage flow; site tables
- **Do not** use portfolio marketing heroes, Archivo/Space Grotesk shouty type, or dark themes

### Spacing Overrides

- **Content Density:** Very high (9/10) - KPI `p-3`, table rows ~36px, flow gaps `8px`

### Typography Overrides

- Page title: medium weight ~1.5-1.65rem (Plus Jakarta Sans)
- KPI / headline values: tabular numerals
- Flow labels: 12px medium

### Color Overrides

- Keep MASTER light shell
- Pipeline stages: sky → teal → emerald → amber → slate
- Status: completed green · need owner amber · cancelled/on_hold red
- No purple gradients; no oversized display type

### Component Overrides

- Dashboard focus: **site installation delivery** (PO Queue → Tracking)
- Current flow: Intake → Survey → SCM → Onsite Delivery → Material Handover → Installation → Acceptance → Completed
- Assignment is **not** a standalone stage — Survey owner from Project Tracking
- Headline band: total sites, in delivery, need Survey owner, completed
- Stage KPIs: Survey · SCM · Onsite Delivery · Material Handover · Installation · Acceptance
- Quick tiles: PO Queue, Projects, All Sites, Need owners
- Prefer Lucide; sticky headers; `overflow-x-auto` on wide tables
- No muted section subtitles under Projects section titles

### Section Order

1. Page header + actions (PO Queue, Projects, Refresh)
2. Headline band (total / in delivery / need Survey owner / completed)
3. Delivery flow strip (clickable stage chips with counts)
4. Stage KPI cards (6 active delivery steps)
5. Quick tiles (PO Queue / Projects / All Sites / Need owners)
6. Pipeline chart + delivery scope mix
7. Recent sites + needs attention

### Avoid

- Legacy “Assign owners” stage as a primary funnel step
- Portfolio value / hours logged / timesheet approval as primary dashboard metrics
- Task board / budget category as primary navigation from dashboard
- Dark-mode-by-default
- Emoji icons, marketing CTAs, pill clusters
