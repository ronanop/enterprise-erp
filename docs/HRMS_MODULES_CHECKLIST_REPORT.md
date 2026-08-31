# HRMS Modules — Inventory & Completion Checklist

**Project:** `cache_erp_hrms_payroll`  
**Scope:** HRMS admin stack (`apps/api` + `apps/web` under `/hr`)  
**Excluded:** `apps/employee-app` (ESS mobile portal — out of scope for this report)  
**Report date:** 2026-08-06  
**Source:** Codebase structure, `apps/web/src/config/hr-nav.ts`, API routers under `modules/{foundation,organization,master_data,hr,payroll,recruitment,ess}`, and enterprise checklist in `docs/08_TRANSFORMATION/HRMS_Enterprise_Transformation_Phases.md` (last bulk update 2026-07-30).

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done — API + DB + admin UI wired for typical use |
| 🟠 | Partial — exists but localStorage fallback, mock, or gaps |
| ❌ | Not started / placeholder only |

**Module %** = weighted score: ✅ = 100%, 🟠 = 50%, ❌ = 0% of checklist rows for that module.

---

## Executive summary

| Metric | Value |
|--------|------:|
| **HRMS modules in scope** | 22 |
| **Weighted average completion** | **~74%** |
| **Enterprise checklist (236 items)** | ~68% done · ~27% partial · ~5% left |
| **Primary apps** | `apps/api` (FastAPI), `apps/web` (Next.js HR workspace) |

```text
Overall HRMS (admin)  [████████████████░░░░]  ~74%
```

---

## Module master checklist (with %)

| # | Module | API path / package | Web route | % | Status |
|---|--------|-------------------|-----------|---:|:------:|
| 1 | **Foundation** (auth, RBAC, notifications) | `modules/foundation` | `/login`, session guards | 78% | 🟠 |
| 2 | **Organization** (company, branch, dept, location) | `modules/organization` | HR Setup (org tabs) | 85% | ✅ |
| 3 | **Master data** (employee master) | `modules/master_data` | `/hr/workforce` | 72% | 🟠 |
| 4 | **HR dashboard** | `GET /hr/reports/*`, dashboard services | `/hr` | 75% | 🟠 |
| 5 | **HR setup & masters** | `/hr/designations`, job-levels, grades, holidays, shifts | `/hr/setup` | 74% | 🟠 |
| 6 | **Workforce & employment** | `/hr/employment`, profiles, lifecycle | `/hr/workforce`, `/hr/workforce/new` | 73% | 🟠 |
| 7 | **Management groups** | `/hr/management-groups` | HR Setup panel | 75% | 🟠 |
| 8 | **Recruitment (ATS)** | `modules/recruitment` | `/hr/recruitment` | 70% | 🟠 |
| 9 | **Onboarding** | `/recruitment/onboarding` | `/hr/onboarding` | 71% | 🟠 |
| 10 | **Leave management** | `/hr/leave-*`, adjustments | `/hr/leave` | 76% | 🟠 |
| 11 | **Attendance & time** | `/hr/attendance`, rules, corrections | `/hr/time`, `/hr/attendance` | 84% | ✅ |
| 12 | **WFH** | WFH services / models | Attendance / ESS policy | 70% | 🟠 |
| 13 | **On duty, OT, Comp Off** | `/hr/on-duty-requests`, `/hr/ot-allotments`, `/hr/compoff-requests` | `/hr/time/ot-allotment` | 80% | ✅ |
| 14 | **Biometric devices** | `/hr/biometric-devices`, device-sync | `/hr/time/biometric-devices` | 65% | 🟠 |
| 15 | **Shift & roster** | `/hr/shifts`, roster, swap, rotation | `/hr/roster` | 68% | 🟠 |
| 16 | **Performance (PMS)** | goals, reviews, KPI, OKR, appraisals | `/hr/talent` | 72% | 🟠 |
| 17 | **Training & learning** | `/hr/training*`, rooms, requests | `/hr/learning` | 70% | 🟠 |
| 18 | **Separation & FNF** | `/hr/separation`, FNF payroll hooks | `/hr/separation` | 74% | 🟠 |
| 19 | **Payroll** | `modules/payroll` (policy, periods, runs, payslips) | `/hr/payroll` | 80% | 🟠 |
| 20 | **HR reports & exports** | `/hr/reports/export` | `/hr/reports` | 82% | ✅ |
| 21 | **ESS admin** (inbox, policies — not employee app) | `/hr/ess-inbox`, `/hr/ess-policies`, ESS password admin | `/hr/ess`, `/hr/ess-inbox`, `/hr/ess-policies` | 76% | 🟠 |
| 22 | **ESS API** (backend only; consumed by employee app) | `modules/ess` `/api/v1/ess` | — (excluded UI) | 75% | 🟠 |

**Roll-up:** (78+85+72+75+74+73+75+70+71+76+84+70+80+65+68+72+70+74+80+82+76+75) / 22 ≈ **74.5%** → **~74%**

---

## Backend API packages (HRMS-related)

| Package | Role in HRMS |
|---------|----------------|
| `foundation` | Login, JWT, RBAC role packs, in-app/email/push notifications |
| `organization` | Org tree used by HR setup and assignments |
| `master_data` | Canonical employee records linked to HR employment |
| `hr` | Core HR domain (40+ routers — see below) |
| `payroll` | Salary structures, runs, statutory, FNF runs |
| `recruitment` | ATS, offers, interviews, onboarding hire |
| `ess` | Employee-facing REST (reported here for API completeness only; UI excluded) |

**Not in scope:** `crm`, `finance`, `inventory`, `sales`, `manufacturing`, `procurement`, `quality`, `project`, `asset`, `helpdesk`, `grc`, `document`, `ecommerce`, `integration`, `portal`, `analytics` (full ERP modules outside HRMS).

### HR API sub-routers (`/api/v1/hr/...`)

| Area | Routers / endpoints |
|------|---------------------|
| Org & job structure | designations, job-levels, grades, department/designation assignments |
| Workforce | employee-profiles, employment, employee-documents, management-groups |
| Time | attendance, attendance-corrections, attendance-rules, weekly-off-policies, on-duty, OT allotments, compoff-requests, biometric-devices |
| Shifts | shifts, shift-assignments, roster-entries, shift-rotations, shift-swaps |
| Leave | leave-types, leave-balances, leave-requests, leave-adjustments |
| Talent | goals, performance-reviews, kpis, okrs, appraisals |
| Learning | training, training-attendance, training-rooms, training-requests |
| Exit | separation (+ FNF prepare/settle) |
| Admin ESS | ess-inbox, ess-policies |
| Reporting | reports (CSV/PDF export) |

### Payroll API sub-routers (`/api/v1/payroll/...`)

Periods, **payroll policy** (Phase 0), salary structures/components, employee salaries, runs & lines, payslips, bonuses, reimbursements, loans, adjustments, postings, summaries, reports.

### Recruitment API (`/api/v1/recruitment/...`)

Job requisitions, postings, candidates, applications, interviews, offers, onboarding cases, talent pool, background checks, recruitment reports.

---

## Web HR workspace routes (`apps/web`)

| Route | Module |
|-------|--------|
| `/hr` | Dashboard |
| `/hr/ess`, `/hr/ess-inbox` | ESS admin / approvals |
| `/hr/ess-policies` | ESS policy administration |
| `/hr/workforce`, `/hr/workforce/new`, `/hr/workforce/[id]` | Workforce |
| `/hr/setup` | HR Setup |
| `/hr/leave` | Leave |
| `/hr/time`, `/hr/attendance`, `/hr/time/ot-allotment`, `/hr/time/biometric-devices` | Attendance & time |
| `/hr/roster` | Shift & roster |
| `/hr/talent` | Performance |
| `/hr/learning` | Training |
| `/hr/separation` | Separation |
| `/hr/recruitment` | Recruitment |
| `/hr/onboarding` | Onboarding |
| `/hr/payroll` | Payroll |
| `/hr/reports` | Reports |

---

## Detailed checklists by module

### 1. Foundation — 78%

- [x] Login & session (100%)
- [x] HR role packs (Super Admin, HR Admin, HR Executive, Manager, Employee) (100%)
- [x] Notification service + templates (100%)
- [x] In-app notification delivery (100%)
- [~] Email channel delivery (50%)
- [~] Push / FCM (env-gated stub) (50%)
- [~] Audit trails across all HR writes (40%)

### 2. Organization — 85%

- [x] Companies, branches, departments, locations (100%)
- [x] Cost centers & business units (100%)
- [x] HR Setup API-backed org tabs (100%)
- [~] Geofence on locations (80%)

### 3. Master data & workforce — 72%

- [x] Employee directory & profile (100%)
- [x] KYC validators (Aadhaar, PAN, IFSC, UAN) (100%)
- [x] Employment lifecycle APIs (100%)
- [~] Manager / location mandatory enforcement (50%)
- [~] Employment types master (local) (40%)
- [x] Lightweight add employee `/hr/workforce/new` (100%)
- [~] Lifecycle timeline UI (50%)

### 4. HR dashboard — 75%

- [x] Executive dashboard component (100%)
- [x] KPI tiles / workforce metrics (80%)
- [~] Real-time analytics depth (50%)

### 5. HR setup & masters — 74%

- [x] Branches, departments, designations, locations (API) (100%)
- [x] Leave types, holidays, shifts (API) (100%)
- [x] Job levels & grades (API) (100%)
- [x] Salary components / tax / PF-ESI setup tabs (API) (100%)
- [~] Leave policies tab (local) (40%)
- [~] Employment types, document types (local) (40%)
- [~] Approval flows setup (local) (30%)

### 6. Recruitment — 70%

- [x] Job requisition & publish (API-first) (100%)
- [x] Applications & pipeline advance/reject (100%)
- [x] Interviews schedule/update (100%)
- [~] Offers release & accept chain (60%)
- [~] Full UI SoR without localStorage (50%)
- [~] Recruitment reports in admin (50%)

### 7. Onboarding — 71%

- [x] API onboarding complete → employee + employment (100%)
- [x] Mandatory document gates (100%)
- [x] Portal document & signature upload (100%)
- [~] Onboarding cases in browser storage (40%)
- [x] Activation with manual Emp ID + payroll eligible (100%)

### 8. Leave management — 76%

- [x] Leave types CL/SL/EL/CO/LOP/ML/PL (100%)
- [x] Emp → Manager → HR approval (100%)
- [x] Sandwich rule & adjustments (100%)
- [x] Carry-forward year-end job (100%)
- [~] Configurable approval matrix (30%)
- [~] Half-day & cycle enforcement (50%)
- [~] Full leave policy engine (40%)

### 9. Attendance & time — 84%

- [x] Present / absent / late / half-day / week-off / holiday (100%)
- [x] Auto-absent Celery + miss punch (100%)
- [x] Corrections workflow (100%)
- [x] CSV import (100%)
- [x] Geo punch & attendance rules API (100%)
- [~] WFH workflow depth (60%)
- [~] OT payroll integration edge cases (70%)

### 10. On duty, OT, Comp Off — 80%

- [x] On-duty requests + attendance write-back (100%)
- [x] OT allotment approve/reject (100%)
- [x] Comp Off Emp→Mgr→HR + credit (100%)
- [~] Overday / complex OT rules (60%)

### 11. Biometric — 65%

- [x] Device registry & API keys (100%)
- [x] Generic device-sync ingest (100%)
- [~] Vendor-specific protocols (30%)
- [~] Production device ops (50%)

### 12. Shift & roster — 68%

- [x] Shift CRUD & night shift (100%)
- [x] Roster entries + calendar persist (100%)
- [x] Punch uses roster / assignment (100%)
- [~] Shift swap / rotation UI vs API (60%)
- [~] Manager assignment workflow polish (50%)

### 13. Performance (PMS) — 72%

- [x] Goals, reviews, appraisals API (100%)
- [x] KPI & OKR API tables (100%)
- [~] PMS cycles / feedback / PIP (30%)
- [~] Remove PMS localStorage dual-write (50%)

### 14. Training & learning — 70%

- [x] Training programs & attendance API (100%)
- [x] Training rooms & requests (100%)
- [~] HR admin UX completeness (60%)
- [~] Compliance & certifications (40%)

### 15. Separation & FNF — 74%

- [x] Dual-stage separation workflow (100%)
- [x] FNF prepare / settle + encashment & gratuity (100%)
- [x] Clearance checklist & exit interview capture (100%)
- [~] Notice period tracking UI (50%)
- [~] Asset clearance integration (60%)

### 16. Payroll — 80%

- [x] Payroll runs calculate with attendance/leave (100%)
- [x] PF / ESI / PT / bonus / arrears / incentives (100%)
- [x] Payslip generate & issue (90%)
- [x] FNF settlement runs (100%)
- [x] Company payroll policy & 20–20 periods (Phase 0–2) (85%)
- [~] Leave LOP integration (Phase 3) (75%)
- [~] Structure lines vs gross-only engine (60%)
- [~] Hub without local cache fallback (55%)

### 17. HR reports — 82%

- [x] Attendance, leave, headcount, late, OT exports (100%)
- [x] Probation, joining, exit CSV/PDF (100%)
- [~] Payroll report richness (50%)
- [~] Advanced filters on exports (60%)

### 18. ESS admin (HR web only) — 76%

- [x] ESS inbox / approval notifications (100%)
- [x] ESS policies admin & acknowledgements (90%)
- [x] ESS password admin (100%)
- [~] Full parity with all ESS request types in inbox (60%)

### 19. ESS API (backend, no employee-app UI) — 75%

- [x] Punch, leave, bank, KYC, documents (100%)
- [x] Team leave manager actions (100%)
- [x] Training / performance / separation read APIs (100%)
- [~] Announcements (derived) (50%)
- [~] Remove all mock fallbacks (55%)

### 20. Notifications (cross-cutting) — 71%

- [x] Probation, confirmation, leave, separation (100%)
- [x] Attendance correction, shift change, payroll approve (100%)
- [x] Birthday, anniversary, holiday reminders (100%)
- [~] Central template coverage for all events (60%)
- [~] Email delivery production-ready (50%)

### 21. Management groups — 75%

- [x] API & HR Setup panel (100%)
- [~] Used across all approval routing (50%)

### 22. Platform hygiene (localStorage / mocks) — 52%

- [~] ATS / payroll / PMS API-first writes (55%)
- [~] No browser SoR for masters (45%)
- [x] ESS default mock off (100%)
- [~] Onboarding case migration to API (40%)

---

## HR domain models inventory (`modules/hr/models`)

| Model domain | Models |
|--------------|--------|
| Workforce | `HrEmployeeProfile`, `HrEmployment`, `HrEmployeeDocument`, `HrDepartmentAssignment`, `HrDesignationAssignment` |
| Structure | `HrDesignation`, `HrJobLevel`, `HrGrade`, `HrManagementGroup` |
| Time | `HrAttendance`, `HrAttendanceCorrection`, `HrAttendanceRule`, `HrWeeklyOffPolicy`, `HrWfhRequest`, `HrOnDutyRequest` |
| Shifts | `HrShift`, `HrShiftAssignment`, `HrRosterEntry`, `HrShiftRotation`, `HrShiftSwapRequest` |
| Leave | `HrLeaveType`, `HrLeaveBalance`, `HrLeaveRequest`, `HrLeaveAdjustment`, `HrCompoffRequest` |
| OT / devices | `HrOtAllotment`, `HrBiometricDevice` |
| Calendar | `HrHolidayCalendar` |
| Performance | `HrGoal`, `HrPerformanceReview`, `HrAppraisal`, `HrKpi`, `HrOkr`, `HrOkrKeyResult` |
| Learning | `HrTraining`, `HrTrainingAttendance`, `HrTrainingRoom`, `HrTrainingRequest` |
| Exit | `HrSeparation` |
| ESS policy | `HrEssPolicy`, `HrEssPolicyAck` |

---

## Suggested next priorities (admin HRMS)

1. Migrate onboarding cases & remaining ATS/payroll hub data off `localStorage`.
2. Payroll **Phases 0–6** (policy, 20–20, shift-N, LOP, salary/PF, payslips, bank export, ESS) — see `apps/api/docs/payroll/PHASE6-ROLLOUT.md`; optional: wire bank-export button in payroll UI.
3. PMS cycles, feedback, and PIP APIs.
4. Biometric vendor adapters and production push/email hardening.
5. Full audit trail on salary, leave approval, and attendance edits.

---

## Related documents

- `docs/08_TRANSFORMATION/HRMS_Enterprise_Transformation_Phases.md` — item-level ✅/🟠/❌ (236 rows)
- `apps/api/docs/payroll/PHASE0-POLICY.md` through `PHASE6-ROLLOUT.md` — payroll policy implementation
- `apps/web/src/config/hr-nav.ts` — sidebar module list

---

*This report excludes `apps/employee-app`. For ESS employee UI status, see `docs/ess-phase-*.md`.*
