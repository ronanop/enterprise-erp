# Analytics & BI Module — Plain-Language Guide

**For:** Anyone new to this ERP (developers, QA, managers)  
**Official spec:** `docs/02_FRD/FRD-18-BI-Reporting-Analytics-Domain.md`  
**App URL:** http://localhost:3000/analytics  
**API prefix:** `/api/v1/analytics`

---

## 1. What is this module in simple words?

**Analytics (Business Intelligence / BI)** is the **management reporting brain** of the ERP.

All other modules (Finance, HR, Sales, Inventory, etc.) **do the work** and store data. Analytics **collects that data**, turns it into **numbers, charts, dashboards, and reports**, and helps leaders make decisions.

**Real-world analogy:**  
- Finance records invoices.  
- Analytics shows “Revenue this month vs target” on a CEO dashboard.

It does **not** replace Finance or HR — it **reads** from them (and other modules) and **presents** insights.

---

## 2. Where does it sit in the bigger ERP picture?

```
All ERP modules (Finance, HR, CRM, Sales, Inventory, …)
        ↓
Operational database (daily transactions)
        ↓
Datasets / Data warehouse layer (Analytics)
        ↓
Metrics & KPIs (calculated numbers)
        ↓
Dashboards & Reports (charts, tables, PDFs)
        ↓
Executives & managers (decisions)
```

| Consumes data from | Examples |
|--------------------|----------|
| Finance | Revenue, AR/AP aging, cash |
| HR | Headcount, attrition, attendance |
| Sales / CRM | Pipeline, conversion |
| Procurement | Spend, vendor performance |
| Inventory | Stock value, turnover |
| Manufacturing | Output, scrap % |
| Quality | Defect rate, NCR count |
| Helpdesk | Ticket volume, SLA % |

---

## 3. The main workflow (how BI is built)

Think of it as building a **reporting pipeline**:

```
Step 1: Dataset        — “What raw data do I need?”
        ↓
Step 2: Metric / KPI   — “What number do I calculate?”
        ↓
Step 3: Dashboard      — “How do I show it visually?”
        ↓
Step 4: Widget         — “Each tile/chart on the dashboard”
        ↓
Step 5: Report         — “Formal document (PDF/Excel)”
        ↓
Step 6: Schedule       — “Email this every Monday 9am”
        ↓
Step 7: Alert          — “Tell me if KPI drops below X”
```

### Simple story example

1. **Dataset** “Monthly Sales” pulls from Sales module.
2. **KPI** “Revenue vs Target” = actual / target × 100.
3. **Dashboard** “CEO View” has widgets for Revenue, Profit, Cash.
4. **Report** “Monthly Management Pack” runs on 1st of month.
5. **Alert** emails CFO if cash position &lt; threshold.

---

## 4. Terminology dictionary

| Term | Plain meaning | In this ERP |
|------|---------------|-------------|
| **BI** | Business Intelligence | Whole analytics module |
| **Dashboard** | One screen with multiple charts/tiles | `dashboards` |
| **Widget** | One chart/number on a dashboard | `dashboard-widgets` |
| **KPI** | Key Performance Indicator — one important number with target | `kpis` |
| **Metric** | A measurable value (can feed KPIs) | `metrics` |
| **Dimension** | Way to slice data (by region, product, month) | `dimensions` |
| **Dataset** | Prepared table of data for reporting | `datasets` |
| **Dataset Source** | Where dataset pulls from (module/DB) | `dataset-sources` |
| **Fact Table** | Warehouse-style fact storage (star schema) | `fact-tables` |
| **Data Snapshot** | Point-in-time copy of data | `data-snapshots` |
| **Data Refresh** | Job to reload/update dataset | `data-refreshes` |
| **Report** | Formal output (table, PDF, Excel) | `reports` |
| **Report Schedule** | Cron/timer for automatic reports | `report-schedules` |
| **Report Execution** | One run of a report (history) | `report-executions` |
| **Alert Rule** | “If KPI &lt; X, notify me” | `alert-rules` |
| **Alert Notification** | One fired alert instance | `alert-notifications` |
| **Subscription** | User signed up to receive dashboard/report | `subscriptions` |
| **Data Export** | Job to export data to file | `data-exports` |
| **Data Import** | Job to import external data in | `data-imports` |
| **Query History** | Log of who ran what query | `query-history` |
| **Usage Audit** | Who viewed which dashboard/report | `usage-audits` |
| **Executive dashboard** | High-level CEO/CFO/COO view | `dashboard_type = executive` |
| **Operational dashboard** | Day-to-day team view | `dashboard_type = operational` |
| **Cross-module report** | Report spanning multiple ERP areas | `report_type = cross_module` |
| **Variance** | Difference between target and actual | Shown on KPI detail page |
| **ETL** | Extract, Transform, Load — moving data for BI | `data-refreshes`, warehouse jobs |

### Dashboard / Report status workflow
```
draft → submitted → approved → published
```
Reports also have **Run** to execute immediately.

---

## 5. Screens in the app — what each menu does

Open **Analytics** → http://localhost:3000/analytics

### A. Analytics Dashboard (home)
- Count of dashboards, KPIs, alerts, reports.
- Pipeline: Dataset → Metric → KPI → Dashboard → Report → Alert.

### B. Presentation layer

| Menu | What it is | Detail page? |
|------|------------|--------------|
| **Dashboards** | Chart screens | Yes — `/analytics/dashboards/{id}` |
| **Widgets** | Tiles on dashboards | Listed; edited via dashboard |
| **Reports** | Formal reports | Yes — `/analytics/reports/{id}` |
| **Report Schedules** | Auto-run timing | List view |

**Executive view (special page):** http://localhost:3000/analytics/executive  
Shows cross-module KPI cards + links to executive dashboards.

### C. Measures & models

| Menu | What it is | Detail page? |
|------|------------|--------------|
| **Datasets** | Data tables for BI | List (+ refresh API) |
| **Metrics** | Number definitions | List |
| **KPIs** | Targets & thresholds | Yes — `/analytics/kpis/{id}` |
| **Dimensions** | Slicing attributes | List |

### D. Delivery & data ops

| Menu | What it is |
|------|------------|
| **Alert Rules** | Threshold rules |
| **Subscriptions** | Who gets what automatically |
| **Data Exports** | Export jobs |
| **Data Imports** | Import jobs |

### E. Advanced / governance (list views)

| Menu | What it is |
|------|------------|
| **Report Executions** | History of report runs |
| **Dataset Sources** | Connector definitions |
| **Fact Tables** | Warehouse facts |
| **Data Refreshes** | ETL refresh jobs |
| **Alert Notifications** | Fired alerts |
| **Query History** | Audit of queries |
| **Usage Audits** | Who used BI |

---

## 6. Executive dashboards (FRD-18 §4) — who sees what

| Role | Typical KPIs (from FRD) |
|------|-------------------------|
| **CEO** | Revenue, profit, cash, sales growth, customer growth |
| **CFO** | AR/AP aging, cash position, budget variance |
| **COO** | Production output, inventory, order fulfillment |
| **CHRO** | Headcount, attrition, attendance, payroll cost |

In the app: create dashboards with `dashboard_type = executive`, then open **Executive** page or dashboard detail.

---

## 7. What the previous developer already built

### Backend (complete)
- Location: `apps/api/src/modules/analytics/`
- 19 API resource groups
- Database schema: `analytics` (tables prefixed `bi_`)
- Celery tasks: dataset refresh, dashboard cache, report scheduler
- Read adapters to Finance, Organization, Portal

### Frontend (partial)
- Dashboard home + lists for all resources.
- **Detail pages:** Dashboard (widgets), Report (run + history), KPI (variance/health).
- **Executive page** for cross-module KPI overview.
- No drag-and-drop dashboard builder yet (widgets show placeholder charts).

### Gaps
- Visual report designer / chart renderer not built.
- Real-time data warehouse sync from all modules is architectural — not fully automated in UI.
- Forecasting (mentioned in FRD) — backend model may exist but no dedicated UI.
- Embedded widgets inside Finance/HR screens — not done (only HR has separate charts).

---

## 8. How to work with it — step by step

### As a business analyst
1. Define **KPIs** with target and warning thresholds.
2. Create **Dataset** (or use existing) pointing to module data.
3. Build **Dashboard** → add **Widgets** linked to KPIs/metrics.
4. Workflow: Submit → Approve → **Publish**.
5. Create **Report** → **Run** to test → add **Schedule** for email delivery.
6. Set **Alert Rule** if KPI goes critical.

### As an executive user
1. Go to **Analytics → Executive** (or open published executive dashboard).
2. Review KPI cards — click for detail.
3. Subscribe to weekly report via **Subscriptions** (when configured).

### As a developer taking over
1. Read FRD-18: `docs/02_FRD/FRD-18-BI-Reporting-Analytics-Domain.md`
2. Trace: `POST /api/v1/analytics/reports/{id}/run`
   - Router: `apps/api/src/modules/analytics/routers/__init__.py`
   - Service layer under `apps/api/src/modules/analytics/service/`
3. Frontend: `apps/web/src/services/analytics-service.ts`
4. UI: `apps/web/src/components/analytics/`

---

## 9. How Analytics relates to module-specific reports

| Module | Has its own reports? | Analytics role |
|--------|---------------------|----------------|
| Finance | Yes (`/finance/reports`) | Enterprise-wide consolidation |
| Quality | Yes (`/quality/reports`) | Feeds quality KPIs into executive view |
| Helpdesk | Yes (`/helpdesk/ticket-reports`) | Feeds SLA/CSAT KPIs |
| Analytics | Central BI hub | Combines all of the above |

**Rule of thumb:** Module reports = operational. Analytics = cross-module + executive.

---

## 10. KRI tracker alignment

Your Excel **Analytics** sheet rows map to:

| Excel row area | App section |
|----------------|-------------|
| Dashboards & Widgets | Dashboards, Widgets, detail page |
| Executive / Operational | Executive page, dashboard types |
| KPI Engine | KPIs + detail page |
| Metrics & Dimensions | Metrics, Dimensions |
| Reporting Engine | Reports + detail + run |
| Scheduled Reporting | Report Schedules, Executions |
| Datasets & Sources | Datasets, Dataset Sources |
| Data Warehouse | Fact Tables, Snapshots, Refreshes |
| Alerts | Alert Rules, Notifications |
| Subscriptions & Export | Subscriptions, Exports, Imports |
| Governance | Query History, Usage Audits |
| Cross-Module Analytics | Adapters + executive KPIs |

---

## 11. Quick reference — file locations

| What | Where |
|------|-------|
| Business requirements | `docs/02_FRD/FRD-18-BI-Reporting-Analytics-Domain.md` |
| Backend module | `apps/api/src/modules/analytics/` |
| Frontend pages | `apps/web/src/app/(app)/analytics/` |
| Frontend components | `apps/web/src/components/analytics/` |
| Config | `apps/web/src/config/analytics.ts` |
| KRI Excel | `Module-KRI-Tracker.xlsx` (sheet: Analytics) |

---

## 12. One-page mental model

```
DATA (datasets)  →  NUMBERS (metrics/KPIs)  →  PRESENTATION (dashboards/reports)  →  ACTION (alerts/schedules)
```

If you are confused, ask: *“Am I looking at raw data, a calculated number, or a visual for a manager?”*  
That tells you which menu you need.

---

*Last updated to match codebase after dashboard/report/KPI detail pages and executive view were added.*
