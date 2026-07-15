# ERP Core v1.15-beta — Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.15-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 — Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal — Confidential |
| **Predecessor** | [ERP Core v1.14-beta](./ERP_Core_v1.14-beta.md) |
| **Ready For** | Sprint 21 — Enterprise Integration Hub |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.15-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-15 |
| **Previous Release** | ERP Core v1.14-beta |
| **Architecture Lock** | v1.1 — Preserved |
| **Recommended Git Tag** | `v1.15-beta` |

---

## 2. Sprint 20 Highlights

Sprint 20 delivered the **Business Intelligence & Analytics** domain (FRD-18 / ERD_20) as the centralized enterprise analytics platform — dashboards → reports → datasets / semantic layer → refresh → alerts → delivery → usage governance — while **existing masters remain authoritative (C-01)**. No duplicate employee / customer / product / vendor / department masters. Analytics is **read-only** over operational ERP domains: **no** `PostingService`, **no** `fin_*` writes, UUID / query-key sources only, and **no peer ORM writes**.

| Capability | Delivery |
|------------|----------|
| **Analytics Module** | `apps/api/src/modules/analytics/` — Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Dashboards** | Executive / operational dashboards with submit / approve / publish |
| **Dashboard Widgets** | KPI tiles, charts, tables, gauges, and layout widgets |
| **Reports** | Operational / financial / cross-module / ad-hoc reports with run |
| **Report Schedules** | Cron-based scheduled report delivery |
| **Report Executions** | Execution ledger with output URI / status |
| **Datasets** | Analytical dataset catalog with submit / approve / refresh |
| **Dataset Sources** | Module-bound read sources (UUID / query key — no peer FK) |
| **Metrics** | Aggregation / formula metric definitions |
| **KPIs** | Target / threshold KPIs with submit / approve |
| **Dimensions** | Time / org / product / customer / vendor / custom dims |
| **Fact Tables** | Star-schema fact metadata |
| **Data Snapshots** | Point-in-time dataset snapshots |
| **Data Refresh** | Full / incremental / rebuild refresh jobs |
| **Alert Rules** | Threshold alert configuration with submit / approve |
| **Alert Notifications** | Fired alerts with acknowledge |
| **Subscriptions** | Dashboard / report / KPI / alert subscriptions |
| **Data Export** | CSV / XLSX / JSON / PDF / Parquet exports |
| **Data Import** | External file ingest into BI datasets only |
| **Query History** | Ad-hoc / dataset query governance ledger |
| **Usage Audit** | View / run / export / publish usage audit |
| **Engines (20)** | Dashboard · DashboardWidget · Report · ReportSchedule · ReportExecution · Dataset · DatasetSource · Metric · Kpi · Dimension · FactTable · DataSnapshot · DataRefresh · AlertRule · AlertNotification · Subscription · DataExport · DataImport · QueryHistory · UsageAudit |

**Services:** `AnalyticsApplicationService`, `DashboardService`, `DashboardWidgetService`, `ReportService`, `ReportScheduleService`, `ReportExecutionService`, `DatasetService`, `DatasetSourceService`, `MetricService`, `KpiService`, `DimensionService`, `FactTableService`, `DataSnapshotService`, `DataRefreshService`, `AlertRuleService`, `AlertNotificationService`, `SubscriptionService`, `DataExportService`, `DataImportService`, `QueryHistoryService`, `UsageAuditService`, **`AnalyticsIntegrationService`**.

**Supporting delivered items:** document numbering (`DASH` / `RPT` / `REX` / `DS` / `KPI` / `ALR` / `SUB` / `EXP` / `IMP` / `RFH` / `SNP`), Celery jobs (`dataset_refresh_scheduler`, `dashboard_cache_refresh`, `report_scheduler`, `alert_monitor`, `usage_statistics_refresh`, `retry_failed_refresh`), RBAC roles (`BI_ANALYST`, `BI_MANAGER`, `DATA_STEWARD`, `BI_ADMIN`), and workflows (`BI_DASHBOARD_APPROVAL`, `BI_REPORT_APPROVAL`, `BI_KPI_APPROVAL`, `BI_DATASET_REFRESH`, `BI_ALERT_REVIEW`).

---

## 3. Analytics Module

| Item | Value |
|------|--------|
| **Schema** | `analytics` |
| **Prefix** | `bi_` |
| **Business Tables** | **20** |
| **ERD** | ERD_20 Business Intelligence & Analytics (locked) |
| **FRD** | FRD-18 Business Intelligence & Analytics |
| **API mount** | `/api/v1/analytics` |

**Tables:** `bi_dashboard`, `bi_dashboard_widget`, `bi_report`, `bi_report_schedule`, `bi_report_execution`, `bi_dataset`, `bi_dataset_source`, `bi_metric`, `bi_kpi`, `bi_dimension`, `bi_fact_table`, `bi_data_snapshot`, `bi_data_refresh`, `bi_alert_rule`, `bi_alert_notification`, `bi_subscription`, `bi_data_export`, `bi_data_import`, `bi_query_history`, `bi_usage_audit`.

**Coverage:** dashboards · widgets · reports · schedules · executions · datasets · sources · metrics · KPIs · dimensions · fact tables · snapshots · refresh · alert rules · alert notifications · subscriptions · exports · imports · query history · usage audit.

**API mount:** `/api/v1/analytics` — dashboards (+ submit / approve / publish), dashboard-widgets, reports (+ submit / approve / publish / run), report-schedules, report-executions, datasets (+ submit / approve / refresh), dataset-sources, metrics, kpis (+ submit / approve), dimensions, fact-tables, data-snapshots, data-refreshes (+ submit), alert-rules (+ submit / approve), alert-notifications (+ acknowledge), subscriptions, data-exports (+ run), data-imports (+ run), query-history, usage-audits.

---

## 4. Cross Module Integrations

Analytics **never** duplicates employee, customer, product, vendor, or department masters. **Existing masters remain authoritative (C-01)**. All operational ERP domains are **read-only analytical sources**. Peer bindings use UUID / query keys — **never** via direct ORM writes outside `bi_*`.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_employee` · `master_customer` · `master_product` · `master_vendor` (C-01)** — **no duplicate masters** |
| **Organization** | **`org_department` only** — no BI department master |
| **Finance** | **Analytical read only** — **no PostingService** · **no `fin_*` writes** |
| **Sales** | Dataset source / UUID only — **no writes** |
| **Procurement** | Dataset source / UUID only — **no writes** |
| **Inventory** | Dataset source / UUID only — **no writes** |
| **Manufacturing** | Dataset source / UUID only — **no writes** |
| **Quality** | Dataset source / UUID only — **no writes** |
| **CRM** | Dataset source / UUID only — **no writes** |
| **HR** | Dataset source / employee via Master Data — **read only / no `hr_*` writes** |
| **Payroll** | Dataset source — **read only / no `pay_*` writes** |
| **Recruitment** | Dataset source — **read only / no writes** |
| **Project** | Dataset source / UUID only — **no writes** |
| **Asset** | Dataset source / UUID only — **no writes** |
| **Service** | Dataset source / UUID only — **no writes** |
| **Helpdesk** | Dataset source / UUID only — **no writes** |
| **Document** | Dataset source / UUID only — **no writes** |
| **GRC** | Dataset source / UUID only — **no writes** |
| **Foundation** | **Workflow** (`BI_DASHBOARD_APPROVAL`, `BI_REPORT_APPROVAL`, `BI_KPI_APPROVAL`, `BI_DATASET_REFRESH`, `BI_ALERT_REVIEW`); **RBAC** (`analytics.*` permissions; roles `BI_ANALYST`, `BI_MANAGER`, `DATA_STEWARD`, `BI_ADMIN` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **1359** |
| **OpenAPI Paths** | **868** |
| **Analytics Routes** | **98** |
| **Analytics OpenAPI Paths** | **58** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; Business Intelligence & Analytics APIs are visible under `/api/v1/analytics/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0376_seed_analytics_workflows` |
| **Migration range (this release delta)** | `0355_create_analytics_schema` → `0376_seed_analytics_workflows` |
| **Approximate business tables** | Approximately **348** (~328 at v1.14-beta + 20 Analytics) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `payroll`, `recruitment`, `project`, `asset`, `service`, `helpdesk`, `document`, `grc`, **`analytics`** (**22**) |

```text
0355_create_analytics_schema
        ↓
0376_seed_analytics_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** — head `0376_seed_analytics_workflows` |
| **FastAPI Startup** | **PASS** — Application startup complete (validated on port **8031**; port 8000 unavailable) |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (1802 files)** |
| **Pytest** | **PASS (266)** |

Validation completed successfully. Head `0376_seed_analytics_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and Analytics routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| — | None required |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** — no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | Analytics domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/analytics` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed — Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · Helpdesk · Document · GRC untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 21 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.16-beta** (planned) |
| **Sprint** | **Sprint 21 — Enterprise Integration Hub** |
| **Primary domain** | **Enterprise Integration Hub** (FRD-21) |

**Planned scope (planning only — no implementation in this release):**

- Integration connectors / message routes / retry & dead-letter foundation
- Continuity with Master Data party / employee masters (C-01)
- Optional cross-links to Analytics · Finance · Sales · Document via UUID / services only
- No redesign of Analytics · GRC · Document · Finance modules

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.15-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` · `v1.7-beta` · `v1.8-beta` · `v1.9-beta` · `v1.10-beta` · `v1.11-beta` · `v1.12-beta` · `v1.13-beta` · `v1.14-beta` unchanged |
| **Version** | **ERP Core v1.15-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · Helpdesk · Document · GRC · **Analytics** |
| **Alembic head** | **`0376_seed_analytics_workflows`** |
| **Tests** | **266 passed** |
| **Routes** | **1359** FastAPI · **868** OpenAPI · **98** Analytics · **58** Analytics OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest — **ALL PASS** |
| **Next** | **Sprint 21 — Enterprise Integration Hub** |
| **Ready for Git Tag** | **`v1.15-beta`** |

---

## 11. Version Timeline

| Version | Date | Scope | Alembic Head | Tests |
|---------|------|--------|--------------|-------|
| **v1.0-alpha** | 2026-07-13 | Sprints 0–5 (Foundation → Sales) | `0055_seed_sales_workflows` | 77 passed |
| **v1.1-beta** | 2026-07-13 | Sprints 0–6 (+ Procurement P2P) | `0077_seed_proc_workflows` | 99 passed |
| **v1.2-beta** | 2026-07-13 | Sprints 0–7 (+ Inventory & Warehouse) | `0094_seed_inv_workflows` | 113 passed |
| **v1.3-beta** | 2026-07-14 | Sprints 0–8 (+ Manufacturing & Production) | `0114_seed_mfg_workflows` | 127 passed |
| **v1.4-beta** | 2026-07-14 | Sprints 0–9 (+ Quality Management) | `0135_seed_qm_workflows` | 146 passed |
| **v1.5-beta** | 2026-07-14 | Sprints 0–10 (+ CRM) | `0156_seed_crm_workflows` | 158 passed |
| **v1.6-beta** | 2026-07-14 | Sprints 0–11 (+ HRMS) | `0178_seed_hr_workflows` | 169 passed |
| **v1.7-beta** | 2026-07-14 | Sprints 0–12 (+ Payroll) | `0200_seed_payroll_workflows` | 179 passed |
| **v1.8-beta** | 2026-07-14 | Sprints 0–13 (+ Recruitment) | `0222_seed_recruitment_workflows` | 189 passed |
| **v1.9-beta** | 2026-07-14 | Sprints 0–14 (+ Project) | `0244_seed_project_workflows` | 199 passed |
| **v1.10-beta** | 2026-07-14 | Sprints 0–15 (+ Asset) | `0266_seed_asset_workflows` | 209 passed |
| **v1.11-beta** | 2026-07-15 | Sprints 0–16 (+ Service) | `0288_seed_service_workflows` | 219 passed |
| **v1.12-beta** | 2026-07-15 | Sprints 0–17 (+ Helpdesk) | `0310_seed_helpdesk_workflows` | 230 passed |
| **v1.13-beta** | 2026-07-15 | Sprints 0–18 (+ Document / DMS) | `0332_seed_document_workflows` | 241 passed |
| **v1.14-beta** | 2026-07-15 | Sprints 0–19 (+ GRC) | `0354_seed_grc_workflows` | 253 passed |
| **v1.15-beta** | 2026-07-15 | Sprints 0–20 (+ Analytics / BI) | `0376_seed_analytics_workflows` | 266 passed |

```text
v1.14-beta ──(+ Sprint 20 Analytics / BI)──► v1.15-beta ──► Sprint 21 Integration Hub (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-15 | Initial ERP Core v1.15-beta release notes after Sprint 20 validation |

---

**Confirmations**

- `ERP_Core_v1.15-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.15-beta`**
- Ready to begin Sprint 21 planning

**ERP Core v1.15-beta release documentation completed and ready for release approval.**
