# ERP Core v1.8-beta - Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.8-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 - Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal - Confidential |
| **Predecessor** | [ERP Core v1.7-beta](./ERP_Core_v1.7-beta.md) |
| **Ready For** | Sprint 14 - Project Management |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.8-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-14 |
| **Previous Release** | ERP Core v1.7-beta |
| **Architecture Lock** | v1.1 - Preserved |
| **Recommended Git Tag** | `v1.8-beta` |

---

## 2. Sprint 13 Highlights

Sprint 13 delivered the **Recruitment & Talent Acquisition** domain (FRD-11 product track / ERD_13) as the hire-to-onboard funnel after HR and Payroll - without treating candidates as employees, without duplicating employee / department / designation / company masters (C-01), and without direct writes to `hr_*` or `pay_*` tables.

| Capability | Delivery |
|------------|----------|
| **Recruitment Module** | `apps/api/src/modules/recruitment/` - Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Job Requisitions** | Requisition create / submit / approve with openings, department, hiring manager |
| **Job Postings** | Publish from approved requisitions (internal / external / agency channels) |
| **Candidates** | Pre-employee person master (`rec_candidate`); **Candidate ≠ Employee** |
| **Applications** | Candidate ↔ requisition / posting pipeline with stage progression |
| **Interviews** | Schedule / complete interview rounds (HR / technical / manager / final) |
| **Interview Feedback** | Per-interviewer scores and recommendations |
| **Offers** | Offer create / submit / approve / send with joining and compensation |
| **Offer Approvals** | Multi-level approval trail on offers |
| **Background Verification** | BGV create / submit / approve gate before hire |
| **Reference Checks** | Reference contact and feedback capture |
| **Talent Pool** | Named pool membership for future / passive candidates |
| **Onboarding** | Checklist + complete flow: Master Data `EmployeeService.create_employee` then HR employment request |
| **Recruitment Reports** | Funnel / time-to-hire / source ROI aggregate snapshots |
| **Engines (20)** | JobRequisition · JobPosting · Candidate · CandidateDocument · Resume · Application · ApplicationStage · Interview · InterviewFeedback · Offer · OfferApproval · BackgroundVerification · ReferenceCheck · Recruiter · RecruitmentSource · TalentPool · CandidateNote · Onboarding · OnboardingTask · RecruitmentReport |

**Services:** `RecruitmentApplicationService`, `JobRequisitionService`, `JobPostingService`, `CandidateService`, `ApplicationService`, `InterviewService`, `OfferService`, `BackgroundVerificationService`, `RecruiterService`, `TalentPoolService`, `OnboardingService`, `RecruitmentReportService`, **`RecruitmentIntegrationService`**.

**Supporting delivered items:** document numbering (`REQ` / `POST` / `CAN` / `APP` / `INTV` / `OFF` / `BGV` / `ONB`), Celery jobs (`interview_reminders`, `offer_expiry_notifications`, `background_verification_followups`, `candidate_followup_alerts`, `onboarding_due_alerts`, `retry_hr_handoff`), RBAC roles (`RECRUITER`, `RECRUITMENT_MANAGER`, `HR_ONBOARDING`, `HIRING_MANAGER`), and workflows (`REC_JOB_APPROVAL`, `REC_OFFER_APPROVAL`, `REC_BACKGROUND_APPROVAL`, `REC_ONBOARDING_APPROVAL`).

---

## 3. Recruitment Module

| Item | Value |
|------|--------|
| **Schema** | `recruitment` |
| **Prefix** | `rec_` |
| **Business Tables** | **20** |
| **ERD** | ERD_13 Recruitment (locked) |
| **FRD** | FRD-11 Recruitment & Talent Acquisition |
| **API mount** | `/api/v1/recruitment` |

**Tables:** `rec_job_requisition`, `rec_job_posting`, `rec_candidate`, `rec_candidate_document`, `rec_resume`, `rec_application`, `rec_application_stage`, `rec_interview`, `rec_interview_feedback`, `rec_offer`, `rec_offer_approval`, `rec_background_verification`, `rec_reference_check`, `rec_recruiter`, `rec_recruitment_source`, `rec_talent_pool`, `rec_candidate_note`, `rec_onboarding`, `rec_onboarding_task`, `rec_recruitment_report`.

**Coverage:** job requisitions · job postings · candidates · applications · interviews · interview feedback · offers · offer approvals · background verification · reference checks · talent pool · onboarding · recruitment reports.

**API mount:** `/api/v1/recruitment` - job-requisitions (+ submit / approve), job-postings (+ publish), recruitment-sources, recruiters, candidates, candidate-documents, resumes, applications, application-stages, interviews, interview-feedback, offers (+ submit / approve / send), offer-approvals, background-verifications (+ submit / approve), reference-checks, talent-pools, candidate-notes, onboarding (+ submit / approve / complete), onboarding-tasks, reports.

---

## 4. Cross Module Integrations

Recruitment **never** duplicates employee, department, designation, or company masters. **Candidate ≠ Employee.** Employee identity is created **only** through Master Data `EmployeeService` at onboarding completion (C-01), then HR is invoked via integration services - **never** direct ORM writes to peer domains.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_employee` only (C-01)** for staff FKs; **create employee only** via `EmployeeService.create_employee` on onboarding complete - store `employee_id`; **never** treat `rec_candidate` as employee |
| **Organization** | **`org_department` only** - **no recruitment department master** |
| **HR** | `designation_id` / `hr_employment_request_id` UUID; employment request via `EmploymentService` adapter - **no `hr_*` ORM writes** |
| **Payroll** | Optional `salary_structure_id` UUID + read port - **no `pay_*` writes** |
| **CRM** | Optional `crm_campaign_id` UUID - **no `crm_*` FK / writes** |
| **Finance** | **No Finance writes**; no `fin_*` writes |
| **Inventory** | **No Inventory writes**; no `inv_*` writes |
| **Manufacturing** | **No Manufacturing writes**; no `mfg_*` writes |
| **Quality** | **No Quality writes**; no `qm_*` writes |
| **Sales** | **No Sales writes**; no `sales_*` writes |
| **Foundation** | **Workflow** (`REC_JOB_APPROVAL`, `REC_OFFER_APPROVAL`, `REC_BACKGROUND_APPROVAL`, `REC_ONBOARDING_APPROVAL`); **RBAC** (`recruitment.*` permissions; roles `RECRUITER`, `RECRUITMENT_MANAGER`, `HR_ONBOARDING`, `HIRING_MANAGER` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **698** |
| **OpenAPI Paths** | **487** |
| **Recruitment Routes** | **71** |
| **Recruitment OpenAPI Paths** | **51** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; Recruitment APIs are visible under `/api/v1/recruitment/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0222_seed_recruitment_workflows` |
| **Migration range (this release delta)** | `0201_create_recruitment_schema` → `0222_seed_recruitment_workflows` |
| **Approximate business tables** | Approximately **208** (~188 at v1.7-beta + 20 Recruitment) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `payroll`, **`recruitment`** (**15**) |

```text
0201_create_recruitment_schema
        ↓
0222_seed_recruitment_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** - head `0222_seed_recruitment_workflows` |
| **FastAPI Startup** | **PASS** - Application startup complete |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (1015 files)** |
| **Pytest** | **PASS (189)** |

Validation completed successfully. Head `0222_seed_recruitment_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and Recruitment routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| None | All quality gates passed without code changes |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** - no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | Recruitment domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/recruitment` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed - Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 14 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.9-beta** (planned) |
| **Sprint** | **Sprint 14 - Project Management** |
| **Primary domain** | **Project Management** |

**Planned scope (planning only - no implementation in this release):**

- Project initiation through closure lifecycle
- Task / milestone / resource allocation foundation
- Timesheet and project costing readiness
- Continuity with Organization / Master Data / Finance boundaries
- No redesign of Recruitment · Payroll · HR modules

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.8-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` · `v1.7-beta` unchanged |
| **Version** | **ERP Core v1.8-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · **Recruitment** |
| **Alembic head** | **`0222_seed_recruitment_workflows`** |
| **Tests** | **189 passed** |
| **Routes** | **698** FastAPI · **487** OpenAPI · **71** Recruitment · **51** Recruitment OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest - **ALL PASS** |
| **Next** | **Sprint 14 - Project Management** |
| **Ready for Git Tag** | **`v1.8-beta`** |

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
| **v1.8-beta** | 2026-07-14 | Sprints 0-13 (+ Recruitment) | `0222_seed_recruitment_workflows` | 189 passed |

```text
v1.7-beta ──(+ Sprint 13 Recruitment)──► v1.8-beta ──► Sprint 14 Project Management (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-14 | Initial ERP Core v1.8-beta release notes after Sprint 13 validation |

---

**Confirmations**

- `ERP_Core_v1.8-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.8-beta`**
- Ready to begin Sprint 14 planning

**ERP Core v1.8-beta release documentation completed and ready for release approval.**
