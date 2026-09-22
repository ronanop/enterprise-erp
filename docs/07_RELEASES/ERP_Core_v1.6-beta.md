# ERP Core v1.6-beta - Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.6-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal - Confidential |
| **Predecessor** | [ERP Core v1.5-beta](./ERP_Core_v1.5-beta.md) |
| **Ready For** | Sprint 12 - Payroll (FRD-10) |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.6-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-14 |
| **Previous Release** | ERP Core v1.5-beta |
| **Architecture Lock** | v1.1 - Preserved |
| **Recommended Git Tag** | `v1.6-beta` |

---

## 2. Sprint 11 Highlights

Sprint 11 delivered the **Human Resource Management (HRMS)** domain (FRD-09 / ERD_11) as the enterprise employee-lifecycle layer after identity is established in Master Data - without duplicating `master_employee` (C-01), without creating `hr_department`, and without payroll runs / finance posting.

| Capability | Delivery |
|------------|----------|
| **HR Module** | `apps/api/src/modules/hr/` - Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Employee Lifecycle** | Profile extension, employment terms, department / designation assignment history |
| **Attendance** | Daily capture (present / absent / half_day / WFH / holiday); adjust / lock |
| **Leave Management** | Leave types, balances, requests with submit / approve and balance decrement |
| **Shift Management** | Shift catalog + shift assignment with submit / approve workflow |
| **Holiday Calendar** | Company/year calendars with publish lifecycle |
| **Performance Management** | Performance reviews, goals, appraisals with submit / approve |
| **Training** | Training programs and training attendance assignment |
| **Separation** | Resignation / termination / retirement with clearance; identity sync on complete |
| **Engines (19)** | Designation · EmployeeProfile · Employment · DepartmentAssignment · DesignationAssignment · Shift · ShiftAssignment · HolidayCalendar · LeaveType · LeaveBalance · LeaveRequest · Attendance · EmployeeDocument · PerformanceReview · Goal · Appraisal · Training · TrainingAttendance · Separation |

**Services:** `HRApplicationService`, `DesignationService`, `EmployeeProfileService`, `EmploymentService`, department / designation assignment services, `ShiftService` / `ShiftAssignmentService`, `HolidayCalendarService`, leave type / balance / request services (`LeaveService`), `AttendanceService`, employee document service, `PerformanceService` / goal / appraisal services, `TrainingService` / training attendance service, `SeparationService`, `HRReportService`, **`HRIntegrationService`**.

**Supporting delivered items:** document numbering (`EMPL` / `LVE` / `SFA` / `EDOC` / `PRF` / `TRN` / `SEP`), Celery jobs (attendance auto-lock, leave balance accrual, leave reminders, performance review due, training due alerts, separation follow-ups), RBAC roles (`HR_EMPLOYEE`, `HR_MANAGER`, `HR_EXECUTIVE`, `HR_ADMIN`), and workflows (`HR_LEAVE_APPROVAL`, `HR_SHIFT_CHANGE`, `HR_SEPARATION_APPROVAL`, `HR_PERFORMANCE_APPROVAL`).

---

## 3. Human Resource Management Module

| Item | Value |
|------|--------|
| **Schema** | `hr` |
| **Prefix** | `hr_` |
| **Business Tables** | **19** |
| **ERD** | ERD_11 HR (locked) |
| **FRD** | FRD-09 HR Domain |

**Tables:** `hr_designation`, `hr_employee_profile`, `hr_employment`, `hr_department_assignment`, `hr_designation_assignment`, `hr_shift`, `hr_shift_assignment`, `hr_holiday_calendar`, `hr_leave_type`, `hr_leave_balance`, `hr_leave_request`, `hr_attendance`, `hr_employee_document`, `hr_performance_review`, `hr_goal`, `hr_appraisal`, `hr_training`, `hr_training_attendance`, `hr_separation`.

**Coverage:** attendance · leave management · shift management · performance management · training · separation · employee lifecycle (profile / employment / assignments / documents).

**API mount:** `/api/v1/hr` - designations, employee-profiles, employment, department-assignments, designation-assignments, shifts, shift-assignments, holiday-calendars, leave-types, leave-balances, leave-requests (+ submit / approve), attendance (+ lock), employee-documents (+ verify), performance-reviews (+ submit / approve), goals, appraisals, training (+ assign), training-attendance, separation (+ submit / approve / complete), reports.

---

## 4. Cross Module Integrations

HR **never** duplicates employee identity or department masters and **never** writes peer operational tables. Identity updates go through Master Data application services only.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_employee` only (C-01)**; FKs from HR tables; designation label sync and separation completion via `HrMasterDataAdapter` → `EmployeeService` - **never ORM-writes `master_*` from HR repositories** |
| **Organization** | **`org_department` only**; department assignment via `HrOrganizationAdapter` - **no `hr_department`** |
| **Foundation** | **Workflow** (`HR_LEAVE_APPROVAL`, `HR_SHIFT_CHANGE`, `HR_SEPARATION_APPROVAL`, `HR_PERFORMANCE_APPROVAL`); **Audit** on leave approve, attendance lock, employment end, separation complete, performance approve; **RBAC** (`hr.*` permissions; roles `HR_EMPLOYEE`, `HR_MANAGER`, `HR_EXECUTIVE`, `HR_ADMIN` with `status='active'`) |
| **Payroll readiness** | `HRIntegrationService` exposes **read-only** employment / attendance / leave facts for future Payroll - **no payroll tables** |
| **Finance** | **No finance posting**; no `fin_*` writes |
| **Inventory** | **No Inventory writes**; no `inv_*` writes |
| **Manufacturing** | **No Manufacturing writes**; UUID references only where needed |
| **CRM** | **No CRM writes**; UUID references only where needed |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **556** |
| **OpenAPI Paths** | **385** |
| **HR Routes** | **59** |
| **HR OpenAPI Paths** | **41** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; HR APIs are visible under `/api/v1/hr/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0178_seed_hr_workflows` |
| **Migration range (this release delta)** | `0157_create_hr_schema` → `0178_seed_hr_workflows` |
| **Approximate business tables** | Approximately **168** (~149 at v1.5-beta + 19 HR) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, **`hr`** (**13**) |

```text
0157_create_hr_schema
        ↓
0178_seed_hr_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** - head `0178_seed_hr_workflows` |
| **FastAPI Startup** | **PASS** - Application startup complete |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS** |
| **Pytest** | **PASS (169)** |

Validation completed successfully. Head `0178_seed_hr_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and HR routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| `pyproject.toml` | HR ruff overrides (`E501` / `SIM102`; enums `UP042`) aligned to CRM pattern |
| Import sorting | Ruff `--fix` on `modules/hr/**`, `shared/router.py`, and HR unit / integration tests |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** - no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | HR domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/hr` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed - Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 12 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.7-beta** (planned) |
| **Sprint** | **Sprint 12 - Payroll** |
| **Primary FRD** | **FRD-10 Payroll** |

**Planned scope (planning only - no implementation in this release):**

- Payroll runs and payslips
- Earnings / deductions configuration
- Statutory calculations foundation
- Consumption of HR employment / attendance / leave read exports
- Finance GL posting via approved Finance services only (when in scope)

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.6-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` unchanged |
| **Version** | **ERP Core v1.6-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · **HR** |
| **Alembic head** | **`0178_seed_hr_workflows`** |
| **Tests** | **169 passed** |
| **Routes** | **556** FastAPI · **385** OpenAPI · **59** HR · **41** HR OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest - **ALL PASS** |
| **Next** | **Sprint 12 - Payroll (FRD-10)** |
| **Ready for Git Tag** | **`v1.6-beta`** |

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

```text
v1.5-beta ──(+ Sprint 11 HRMS)──► v1.6-beta ──► Sprint 12 Payroll (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-14 | Initial ERP Core v1.6-beta release notes after Sprint 11 validation |

---

**Confirmations**

- `ERP_Core_v1.6-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.6-beta`**
- Ready to begin Sprint 12 planning

**ERP Core v1.6-beta release documentation completed and ready for release approval.**
