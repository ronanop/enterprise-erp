# ERP Core v1.14-beta — Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.14-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 — Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal — Confidential |
| **Predecessor** | [ERP Core v1.13-beta](./ERP_Core_v1.13-beta.md) |
| **Ready For** | Sprint 20 — Business Intelligence & Analytics |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.14-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-15 |
| **Previous Release** | ERP Core v1.13-beta |
| **Architecture Lock** | v1.1 — Preserved |
| **Recommended Git Tag** | `v1.14-beta` |

---

## 2. Sprint 19 Highlights

Sprint 19 delivered the **Governance, Risk & Compliance (GRC)** domain (FRD-20 / ERD_19) as the centralized enterprise GRC platform — policies → controls → risk → compliance → audit → CAPA / exception / incident → monitor — while **existing masters remain authoritative (C-01)**. No duplicate customer / employee / department masters. Remediation / recovery posting occurs only through Finance `PostingService.post_system_journal()`, storing `finance_journal_id` UUID references only. Document / Helpdesk / Service / Project / Quality / Asset / CRM / Inventory / Manufacturing peer context uses UUID-only refs with **no peer ORM writes**.

| Capability | Delivery |
|------------|----------|
| **GRC Module** | `apps/api/src/modules/grc/` — Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Policies** | Policy register with submit / approve / publish |
| **Policy Versions** | Immutable policy version history |
| **Policy Acknowledgements** | Employee acknowledgement capture |
| **Controls** | Internal control catalog |
| **Control Tests** | Control effectiveness testing |
| **Risk Categories** | Risk taxonomy catalog |
| **Risk Register** | Enterprise risk register with submit / approve |
| **Risk Assessments** | Impact × probability scoring |
| **Risk Treatments** | Accept / avoid / reduce / transfer plans |
| **Compliance Frameworks** | Regulatory / standard frameworks |
| **Compliance Requirements** | Obligation catalog under frameworks |
| **Compliance Assessments** | Compliant / partial / non-compliant assessments |
| **Audit Plans** | Annual / periodic audit planning |
| **Audits** | Audit execution with submit / approve |
| **Audit Findings** | Severity-ranked findings |
| **Corrective Actions** | CAPA with submit / approve / complete |
| **Exceptions** | Policy / control exceptions with approve |
| **Incidents** | Incident register with submit / review / close |
| **Notifications** | GRC-scoped notification delivery ledger |
| **Reports** | Risk / compliance / audit / CAPA snapshots |
| **Engines (20)** | Policy · PolicyVersion · PolicyAcknowledgement · Control · ControlTest · RiskCategory · RiskRegister · RiskAssessment · RiskTreatment · ComplianceFramework · ComplianceRequirement · ComplianceAssessment · AuditPlan · Audit · AuditFinding · CorrectiveAction · Exception · Incident · Notification · Report |

**Services:** `GrcApplicationService`, `PolicyService`, `PolicyVersionService`, `PolicyAcknowledgementService`, `ControlService`, `ControlTestService`, `RiskCategoryService`, `RiskRegisterService`, `RiskAssessmentService`, `RiskTreatmentService`, `ComplianceFrameworkService`, `ComplianceRequirementService`, `ComplianceAssessmentService`, `AuditPlanService`, `GrcAuditService`, `AuditFindingService`, `CorrectiveActionService`, `ExceptionService`, `IncidentService`, `NotificationService`, `GrcReportService`, **`GrcIntegrationService`**.

**Supporting delivered items:** document numbering (`POL` / `CTL` / `CTT` / `RSK` / `RAS` / `RTR` / `CMP` / `AUD` / `FND` / `CAPA` / `EXC` / `INC`), Celery jobs (`policy_review_reminders`, `risk_review_scheduler`, `audit_due_notifications`, `corrective_action_followups`, `compliance_refresh`, `retry_finance_posting`), RBAC roles (`GRC_MANAGER`, `RISK_MANAGER`, `COMPLIANCE_OFFICER`, `GRC_ADMIN`), and workflows (`GRC_POLICY_APPROVAL`, `GRC_RISK_APPROVAL`, `GRC_AUDIT_APPROVAL`, `GRC_CORRECTIVE_APPROVAL`, `GRC_INCIDENT_REVIEW`).

---

## 3. GRC Module

| Item | Value |
|------|--------|
| **Schema** | `grc` |
| **Prefix** | `grc_` |
| **Business Tables** | **20** |
| **ERD** | ERD_19 Governance, Risk & Compliance (locked) |
| **FRD** | FRD-20 Governance, Risk & Compliance |
| **API mount** | `/api/v1/grc` |

**Tables:** `grc_policy`, `grc_policy_version`, `grc_policy_acknowledgement`, `grc_control`, `grc_control_test`, `grc_risk_category`, `grc_risk_register`, `grc_risk_assessment`, `grc_risk_treatment`, `grc_compliance_framework`, `grc_compliance_requirement`, `grc_compliance_assessment`, `grc_audit_plan`, `grc_audit`, `grc_audit_finding`, `grc_corrective_action`, `grc_exception`, `grc_incident`, `grc_notification`, `grc_report`.

**Coverage:** policies · policy versions · acknowledgements · controls · control tests · risk categories · risk register · risk assessments · risk treatments · compliance frameworks · requirements · compliance assessments · audit plans · audits · findings · corrective actions · exceptions · incidents · notifications · reports.

**API mount:** `/api/v1/grc` — policies (+ submit / approve / publish), policy-versions, policy-acknowledgements, controls, control-tests, risk-categories, risk-registers (+ submit / approve), risk-assessments, risk-treatments, compliance-frameworks, compliance-requirements, compliance-assessments, audit-plans, audits (+ submit / approve), audit-findings, corrective-actions (+ submit / approve / complete), exceptions (+ approve), incidents (+ submit / review / close), notifications, reports.

---

## 4. Cross Module Integrations

GRC **never** duplicates customer, employee, or department masters. **Existing masters remain authoritative (C-01)**. Peer domains are consumed via FKs, service adapters, or UUID-only references — **never** via direct ORM writes outside `grc_*`.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_employee` · `master_customer` only (C-01)** — **no duplicate masters** |
| **Organization** | **`org_department` only** — no GRC department master |
| **Finance** | Store **`finance_journal_id` UUID only**; posting **only** through `PostingService.post_system_journal()` — **no direct `fin_*` writes** |
| **Document** | Optional `document_id` **UUID only** — **no `doc_*` FK / no writes** |
| **Helpdesk** | Optional `helpdesk_ticket_id` **UUID only** — **no `hd_*` FK / no writes** |
| **Service** | Optional `service_request_id` **UUID only** — **no `svc_*` FK / no writes** |
| **Project** | Optional `project_id` **UUID only** — **no FK / no writes** |
| **Quality** | Optional `quality_nonconformance_id` **UUID only** — **no FK / no writes** |
| **Asset** | Optional `asset_id` **UUID only** — **no `ast_*` FK / no writes** |
| **CRM** | Optional `crm_opportunity_id` **UUID only** — **no FK / no writes** |
| **Inventory** | Optional `inventory_ref_id` **UUID only** — **no FK / no writes** |
| **Manufacturing** | Optional `production_order_id` **UUID only** — **no FK / no writes** |
| **HR** | Employee refs via Master Data — **read only / no `hr_*` writes** |
| **Payroll** | Optional labor cost **read** — **no `pay_*` writes** |
| **Recruitment** | **Read only / no writes** |
| **Foundation** | **Workflow** (`GRC_POLICY_APPROVAL`, `GRC_RISK_APPROVAL`, `GRC_AUDIT_APPROVAL`, `GRC_CORRECTIVE_APPROVAL`, `GRC_INCIDENT_REVIEW`); **RBAC** (`grc.*` permissions; roles `GRC_MANAGER`, `RISK_MANAGER`, `COMPLIANCE_OFFICER`, `GRC_ADMIN` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **1261** |
| **OpenAPI Paths** | **810** |
| **GRC Routes** | **94** |
| **GRC OpenAPI Paths** | **54** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; GRC APIs are visible under `/api/v1/grc/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0354_seed_grc_workflows` |
| **Migration range (this release delta)** | `0333_create_grc_schema` → `0354_seed_grc_workflows` |
| **Approximate business tables** | Approximately **328** (~308 at v1.13-beta + 20 GRC) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `payroll`, `recruitment`, `project`, `asset`, `service`, `helpdesk`, `document`, **`grc`** (**21**) |

```text
0333_create_grc_schema
        ↓
0354_seed_grc_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** — head `0354_seed_grc_workflows` |
| **FastAPI Startup** | **PASS** — Application startup complete (validated on port **8031**; port 8000 unavailable) |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (1691 files)** |
| **Pytest** | **PASS (253)** |

Validation completed successfully. Head `0354_seed_grc_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and GRC routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| Permissions seed SQL | Aligned `0353_seed_grc_permissions` to Document seed pattern — remove nonexistent `status` / timestamps on `sec_role_permission`; role insert uses `is_system_role` / `is_deleted` / `version` |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** — no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | GRC domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/grc` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed — Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · Helpdesk · Document untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 20 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.15-beta** (planned) |
| **Sprint** | **Sprint 20 — Business Intelligence & Analytics** |
| **Primary domain** | **Business Intelligence & Analytics** (FRD-18) |

**Planned scope (planning only — no implementation in this release):**

- BI dashboards / report definitions / analytics snapshot foundation
- Continuity with Master Data party / employee masters (C-01)
- Optional cross-links to Finance · Sales · GRC · Document via UUID / read services only
- No redesign of GRC · Document · Helpdesk · Finance modules

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.14-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` · `v1.7-beta` · `v1.8-beta` · `v1.9-beta` · `v1.10-beta` · `v1.11-beta` · `v1.12-beta` · `v1.13-beta` unchanged |
| **Version** | **ERP Core v1.14-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · Helpdesk · Document · **GRC** |
| **Alembic head** | **`0354_seed_grc_workflows`** |
| **Tests** | **253 passed** |
| **Routes** | **1261** FastAPI · **810** OpenAPI · **94** GRC · **54** GRC OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest — **ALL PASS** |
| **Next** | **Sprint 20 — Business Intelligence & Analytics** |
| **Ready for Git Tag** | **`v1.14-beta`** |

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

```text
v1.13-beta ──(+ Sprint 19 GRC)──► v1.14-beta ──► Sprint 20 BI & Analytics (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-15 | Initial ERP Core v1.14-beta release notes after Sprint 19 validation |

---

**Confirmations**

- `ERP_Core_v1.14-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.14-beta`**
- Ready to begin Sprint 20 planning

**ERP Core v1.14-beta release documentation completed and ready for release approval.**
