# ERP Core v1.7-beta - Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.7-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal - Confidential |
| **Predecessor** | [ERP Core v1.6-beta](./ERP_Core_v1.6-beta.md) |
| **Ready For** | Sprint 13 - Recruitment / Talent Acquisition |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.7-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-14 |
| **Previous Release** | ERP Core v1.6-beta |
| **Architecture Lock** | v1.1 - Preserved |
| **Recommended Git Tag** | `v1.7-beta` |

---

## 2. Sprint 12 Highlights

Sprint 12 delivered the **Payroll Management** domain (FRD-10 / ERD_12) as the workforce compensation and statutory settlement layer - consuming HR read exports and Master Data employee identity only (C-01), without duplicating employee / department / attendance / leave masters, and posting GL only through Finance `PostingService.post_system_journal()`.

| Capability | Delivery |
|------------|----------|
| **Payroll Module** | `apps/api/src/modules/payroll/` - Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Payroll Runs** | Period-scoped run create / calculate / submit / approve with run lines |
| **Payslips** | Per-employee slip generation from approved run output |
| **Salary Structures** | Structure catalog + structure lines mapped to components |
| **Salary Components** | Earnings / deductions component catalog driving structures and employee assignments |
| **Bonus Management** | Bonus create / submit / approve workflow |
| **Reimbursements** | Employee reimbursement capture against payroll cycles |
| **Loans** | Loan create / submit / approve with installment schedule processing |
| **Statutory Contributions** | Statutory contribution configuration and payroll-cycle application |
| **Payroll Posting** | Posting documents submit / post; Finance journal via PostingService only; store `finance_journal_id` |
| **Payroll Summaries** | Aggregated summary refresh for reporting |
| **Engines (20)** | PayrollPeriod · SalaryStructure · SalaryComponent · SalaryStructureLine · EmployeeSalary · EmployeeSalaryComponent · EarningType · DeductionType · PayrollRun · PayrollRunLine · Payslip · TaxConfiguration · StatutoryContribution · Bonus · Reimbursement · Loan · LoanInstallment · PayrollAdjustment · PayrollPosting · PayrollSummary |

**Services:** `PayrollApplicationService`, `PayrollPeriodService`, `SalaryStructureService`, `SalaryComponentService`, `EmployeeSalaryService`, `PayrollRunService`, `PayslipService`, `BonusService`, `ReimbursementService`, `LoanService`, `PayrollPostingService`, `PayrollReportService`, **`PayrollIntegrationService`**.

**Supporting delivered items:** document numbering for payroll documents, Celery jobs (`payroll_run_scheduler`, `payslip_generation`, `loan_installment_processor`, `bonus_reminders`, `payroll_post_retry`, `refresh_payroll_summary`), RBAC roles (`PAYROLL_EXECUTIVE`, `PAYROLL_MANAGER`, `HR_PAYROLL_ADMIN`, `FINANCE_PAYROLL_REVIEWER`), and workflows (`PAY_PAYROLL_APPROVAL`, `PAY_PAYROLL_POSTING`, `PAY_BONUS_APPROVAL`, `PAY_LOAN_APPROVAL`).

---

## 3. Payroll Module

| Item | Value |
|------|--------|
| **Schema** | `payroll` |
| **Prefix** | `pay_` |
| **Business Tables** | **20** |
| **ERD** | ERD_12 Payroll (locked) |
| **FRD** | FRD-10 Payroll Domain |
| **API mount** | `/api/v1/payroll` |

**Tables:** `pay_payroll_period`, `pay_salary_structure`, `pay_salary_component`, `pay_salary_structure_line`, `pay_employee_salary`, `pay_employee_salary_component`, `pay_earning_type`, `pay_deduction_type`, `pay_payroll_run`, `pay_payroll_run_line`, `pay_payslip`, `pay_tax_configuration`, `pay_statutory_contribution`, `pay_bonus`, `pay_reimbursement`, `pay_loan`, `pay_loan_installment`, `pay_payroll_adjustment`, `pay_payroll_posting`, `pay_payroll_summary`.

**Coverage:** payroll periods · salary structures · salary components · employee salaries · payroll runs · payslips · tax configuration · statutory contributions · bonuses · reimbursements · loans · payroll adjustments · payroll posting · payroll summaries.

**API mount:** `/api/v1/payroll` - payroll-periods, salary-structures, salary-components, earning-types, deduction-types, employee-salaries, employee-salary-components, payroll-runs (+ calculate / submit / approve), payroll-run-lines, payslips, tax-configurations, statutory-contributions, bonuses (+ submit / approve), reimbursements, loans (+ submit / approve), loan-installments, payroll-adjustments, payroll-postings (+ submit / post), payroll-summaries, reports.

---

## 4. Cross Module Integrations

Payroll **never** duplicates employee identity, department, attendance, leave, or employment masters and **never** writes peer operational tables outside its `pay_*` boundary. Finance GL is created only through approved Finance services.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_employee` only (C-01)**; FKs from Payroll tables via `PayrollMasterDataAdapter` - **never create payroll employee tables** |
| **Organization** | **`org_department` only** via `PayrollOrganizationAdapter` - **no payroll department master** |
| **HR** | **Read-only** via `PayrollHrAdapter` → `HRIntegrationService` (employment / attendance / leave facts); `employment_id` UUID reference - **no `hr_*` writes / FKs** |
| **Finance** | Posting **only** through `JournalService` + `PostingService.post_system_journal()`; store **`finance_journal_id` only** - **no direct `fin_*` writes** |
| **Inventory** | **No Inventory writes**; no `inv_*` writes or FKs |
| **Procurement** | **No Procurement writes**; no `proc_*` writes or FKs |
| **Manufacturing** | **No Manufacturing writes**; no `mfg_*` writes or FKs |
| **CRM** | **No CRM writes**; no `crm_*` writes or FKs |
| **Quality** | **No Quality writes**; no `qm_*` writes or FKs |
| **Foundation** | **Workflow** (`PAY_PAYROLL_APPROVAL`, `PAY_PAYROLL_POSTING`, `PAY_BONUS_APPROVAL`, `PAY_LOAN_APPROVAL`); **RBAC** (`payroll.*` permissions; roles `PAYROLL_EXECUTIVE`, `PAYROLL_MANAGER`, `HR_PAYROLL_ADMIN`, `FINANCE_PAYROLL_REVIEWER` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **627** |
| **OpenAPI Paths** | **436** |
| **Payroll Routes** | **71** |
| **Payroll OpenAPI Paths** | **51** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; Payroll APIs are visible under `/api/v1/payroll/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0200_seed_payroll_workflows` |
| **Migration range (this release delta)** | `0179_create_payroll_schema` → `0200_seed_payroll_workflows` |
| **Approximate business tables** | Approximately **188** (~168 at v1.6-beta + 20 Payroll) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, **`payroll`** (**14**) |

```text
0179_create_payroll_schema
        ↓
0200_seed_payroll_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** - head `0200_seed_payroll_workflows` |
| **FastAPI Startup** | **PASS** - Application startup complete |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (903 files)** |
| **Pytest** | **PASS (179)** |

Validation completed successfully. Head `0200_seed_payroll_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and Payroll routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| Import / unused cleanup | Ruff `--fix` on `modules/payroll/**`, payroll tests, and `shared/router.py` (F401 / I001) |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** - no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | Payroll domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/payroll` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed - Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 13 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.8-beta** (planned) |
| **Sprint** | **Sprint 13 - Recruitment / Talent Acquisition** |
| **Primary domain** | **Recruitment / Talent Acquisition** |

**Planned scope (planning only - no implementation in this release):**

- Candidate and requisition lifecycle
- Interview / offer workflows
- Hiring funnel reporting foundation
- Continuity with Master Data employee onboarding (C-01)
- Read/consume HR and Payroll boundaries without redesign

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.7-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` unchanged |
| **Version** | **ERP Core v1.7-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · **Payroll** |
| **Alembic head** | **`0200_seed_payroll_workflows`** |
| **Tests** | **179 passed** |
| **Routes** | **627** FastAPI · **436** OpenAPI · **71** Payroll · **51** Payroll OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest - **ALL PASS** |
| **Next** | **Sprint 13 - Recruitment / Talent Acquisition** |
| **Ready for Git Tag** | **`v1.7-beta`** |

---

## 11. Version Timeline

| Version | Date | Scope | Alembic Head | Tests |
|---------|------|--------|--------------|-------|
| **v1.0-alpha** | 2026-07-13 | Sprints 0-5 (Foundation → Sales) | `0055_seed_sales_workflows` | 77 passed |
| **v1.1-beta** | 2026-07-13 | Sprints 0-6 (+ Procurement P2P) | `0077_seed_proc_workflows` | 99 passed |
| **v1.2-beta** | 2026-07-13 | Sprints 0-7 (+ Inventory & Warehouse) | `0094_seed_inv_workflows` | 113 passed |
| **v1.3-beta** | 2026-07-14 | Sprints 0-8 (+ Manufacturing & Production) | `0114_seed_mfg_workflows` | 127 passed |
| **v1.4-beta** | 2026-07-14 | Sprints 0-9 (+ Quality Management) | `0135_seed_qm_workflows` | 146 passed |
| **v1.5-beta** | 2026-07-14 | Sprints 0-10 (+ CRM) | `0156_seed_crm_workflows` | 158 passed |
| **v1.6-beta** | 2026-07-14 | Sprints 0-11 (+ HRMS) | `0178_seed_hr_workflows` | 169 passed |
| **v1.7-beta** | 2026-07-14 | Sprints 0-12 (+ Payroll) | `0200_seed_payroll_workflows` | 179 passed |

```text
v1.6-beta ──(+ Sprint 12 Payroll)──► v1.7-beta ──► Sprint 13 Recruitment / Talent Acquisition (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-14 | Initial ERP Core v1.7-beta release notes after Sprint 12 validation |

---

**Confirmations**

- `ERP_Core_v1.7-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.7-beta`**
- Ready to begin Sprint 13 planning

**ERP Core v1.7-beta release documentation completed and ready for release approval.**
