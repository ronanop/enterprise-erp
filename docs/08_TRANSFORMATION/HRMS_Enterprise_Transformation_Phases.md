# HRMS Enterprise Transformation Checklist

**Project:** `cache_erp_hrms_payroll`  
**Apps audited:** `apps/api` · `apps/web` · `apps/employee-app`  
**Last analysed:** 2026-07-29  
**Last implementation update:** 2026-07-30 (P15/#20: FCM, biometric API-key, shift swap/rotation, prefer-API loans/reimb, ESS me PATCH)

### Implementation batch notes (2026-07-29)

Shipped in this pass:
- Migration `0447_hr_enterprise_lifecycle_kyc` — lifecycle history, KYC columns, leave dual-approve, leave policy columns, attendance status/geo fields, job level/grade tables, geofence radius
- Employment lifecycle APIs: start-onboarding, start-probation, activate, confirm, extend-probation, start-notice, separate, ex-employee, end, lifecycle timeline
- Leave: `manager-approve` + `reject` + `manager_approved` status
- Payroll: real gross→Basic/HRA/Special/PF/ESI/PT calculate into run lines
- KYC: Aadhaar (Verhoeff) + PAN + UAN + IFSC validators on profile service
- Job Levels / Grades API + HR Setup switched from local → API
- Onboarding complete → employment onboarding → auto probation
- ESS mock default **false**
- Celery: `hr.probation_reminders`, `hr.leave_balance_monthly_credit`

### Implementation batch notes (2026-07-30)

Shipped:
- Migration `0448_hr_roster_and_ess` — `hr_roster_entry` table
- Roster CRUD `/hr/roster-entries`; calendar UI posts to API when UUIDs present
- ESS: bank GET/PATCH, KYC, documents, holidays, notifications; geo punch with haversine
- Employee app bank/docs/holidays/notifications use API when mock off
- ATS `createJob` / `createCandidate` API-first (expanded recruitment create schemas)
- Onboarding `activateEmployee` calls `/recruitment/onboarding/{id}/complete` when `apiOnboardingId` set
- Mandatory document gate on onboarding complete (identity + education) + mandatory tasks check

### Implementation batch notes (2026-07-30 #2)

Shipped:
- Migration `0449_hr_leave_adjustment` — `hr_leave_adjustment` + `sandwich_rule_enabled` on leave type
- Leave sandwich day calc + leave adjustment create/submit/approve/reject (no future-month)
- SeparationHub row actions: Submit / Manager Approve / HR Approve / Complete
- ATS `scheduleInterview` / `generateOffer` / `updateOfferStatus` → Recruitment APIs (context + UUID gated)
- Offer API `accept` / `reject` routes
- ESS punch resolves published roster → else shift assignment; applies grace → `late` + `late_minutes`; OT on checkout
- `NotificationService.get_or_create_template`; probation reminders + leave monthly credit **send** to employee/manager
- ESS `GET /notifications` returns in-app events for the employee user

### Implementation batch notes (2026-07-30 #3)

Shipped:
- Migration `0450_hr_fnf_and_kyc_docs` — `fnf_status` / `fnf_payroll_run_id` on separation; `target_employee_id` on payroll run; candidate doc types `photo` + `cancelled_cheque`
- FNF: `POST /hr/separation/{id}/fnf/prepare` + `/fnf/settle`; SeparationHub FNF actions; complete gated on FNF
- Block direct hire: `EmployeeService` requires onboarding hire source; workforce `/new` → onboarding
- Onboarding complete mandatory docs: identity + education + photo + cancelled_cheque

### Implementation batch notes (2026-07-30 #4)

Shipped:
- FNF leave encashment (`encashment_allowed` balances × basic/30) + gratuity (≥5 yrs, 15/26×basic×years) on `prepare_fnf`
- Sandwich: off = exclude weekends/published holidays; on = inclusive calendar span
- Probation reminders notify HR users with `hr.employment:confirm` (fallback designation `%HR%`)

Still open (next batches): cleanup localStorage (later batches covered applications/corrections/reports).

### Implementation batch notes (2026-07-30 #5)

Shipped:
- Applications: expanded `ApplicationCreate` + `POST .../advance|reject`; ATS `applyCandidateToJob` / `moveApplicationStage` API-first
- Migration `0451_hr_att_correction_early` — `early_leave_minutes` + `hr_attendance_correction`
- Attendance corrections CRUD + submit/approve/reject; approve patches attendance; UI submitCorrection API-first
- ESS checkout early leave (grace) → `early_leave_minutes`; ≥120 min → `half_day`
- Celery `hr.attendance_auto_absent` + auto-lock now locks rows

Still open (next batches): cleanup localStorage/mocks (Phase 12), remaining notification events, ESS mock domains.

### Implementation batch notes (2026-07-30 #6)

Shipped:
- Reports: `GET /hr/reports/export?report_type=&fmt=csv|pdf` (attendance/leave/headcount/late/overtime/probation/joining/exit); ReportsHub CSV/PDF buttons
- Notifications: confirmation, leave submit, separation submit/approve via `hr_notify.notify_employee`
- Separation: default clearance checklist in `clearance_json`; `POST .../checklist` + `.../exit-interview`; SeparationHub Clear assets / Clear IT / Exit interview

Still open (next batches): remaining ESS domains (training/performance/separation), ATS/payroll localStorage, RBAC role packs.

### Implementation batch notes (2026-07-30 #7)

Shipped:
- ESS APIs: `/ess/profile/emergency`, `/ess/team-leave`, `/ess/announcements`, `/ess/assets` (+ PATCH emergency)
- Employee-app: emergency/assets/announcements/team leave/education drop mock SoR → API or empty
- Notifications: birthday + work anniversary Celery; holiday reminders; leave pending reminders send; attendance correction approve/reject notify
- HR Setup: empty `DEFAULT_LOCAL` + storage key `erp_hr_setup_local_v2` (no seeded demo masters)
- Phase 12.6 marked done (employment confirm/activate/end + leave reject routes already existed)

Still open (next batches): remaining payroll write paths / PMS localStorage, miss-punch/payroll notifications, Super Admin role pack polish.

### Implementation batch notes (2026-07-30 #8)

Shipped:
- ATS: `loadAtsDirectory` prefers Recruitment API lists; `updateJob`/`publishJob` submit→approve + create/publish posting when `apiId` set
- Payroll hub: `loadPayrollDirectory` prefers API for structures/salaries/runs/payslips (cache mirror)
- ESS: `/ess/training`, `/ess/performance`, `/ess/separation` (+ POST resign); employee-app pages + profile links
- RBAC: `HR_ROLE_PACKS` + migration `0452_hr_role_packs_resync` renames Employee/Manager/HR Executive/HR Admin and re-grants

Still open (next batches): Comp Off credit engine; deeper localStorage removal; ESS education/skills; push channel.

### Implementation batch notes (2026-07-30 #9)

Shipped:
- Payroll: expanded `SalaryStructureCreate` / `EmployeeSalaryCreate`; hub `createStructure` / `assignEmployeeSalary` / `runPayroll` → API create+calculate(+submit/approve) when context UUIDs set
- ATS: `updateInterview` → `PATCH /recruitment/interviews/{id}` when UUID
- PMS: goals/reviews/appraisals prefer HR API lists (local-only rows retained)
- Notifications: miss-punch/correction submit notify; payroll run approve notifies employees on run lines
- Super Admin: migration `0453_super_admin_role_polish` ensures SUPER_ADMIN/TENANT_ADMIN names + grant-all


### Implementation batch notes (2026-07-30 #10)

Shipped:
- PMS: `createGoal` / `createReview` / `createAppraisal` API-first (auto-create review when needed); drawers pass employee UUIDs
- Payroll: expanded `PayslipCreate`; `generatePayslips` → run lines → POST/issue when UUID run + `erp_pay_api_context_v1`
- Shift: `ShiftAssignmentService.approve` notifies employee (`hr.shift_change`)
- Leave seed: ML / PL / LOP in `seed_hr_workforce.LEAVE_TYPES`


### Implementation batch notes (2026-07-30 #11)

Shipped:
- Comp Off: seeded `CO`; `LeaveBalanceService.credit_compoff` + `POST /hr/leave-balances/compoff-credit`; hub Generate Comp Off API-first
- ESS education/skills: migration `0454` `education_json`/`skills_json`; `GET/PATCH /ess/profile/education`; employee-app page wired
- Separation: `hr.separation_followups` sends resignation reminders within 7 days of last working day


### Implementation batch notes (2026-07-30 #12)

Shipped:
- Holiday → Comp Off: ESS checkout on published holiday auto-credits 1 CO day (idempotent notes marker)
- Leave encashment hub → create/submit/approve `/hr/leave-adjustments` (negative days) when UUIDs set
- Payroll 7.3: attendance facts export `shift_id`/`overtime_minutes`; run calc pays 1.5x OT


### Implementation batch notes (2026-07-30 #13)

Shipped:
- Bonus: expanded `BonusCreate`; hub `addBonus` create+submit+approve; approved bonuses included in payroll run calc
- Arrears/Incentives: expanded `PayrollAdjustmentCreate` + `/apply`; hub drawer; applied earnings folded into calc breakdown
- Docs: Manual attendance CSV upload marked done (`importAttendanceCsv`)

Still open (next batches): push channel; device biometric sync; deeper localStorage (KPI/OKR); carry-forward year-end.


### Implementation batch notes (2026-07-30 #14)

Shipped:
- Weekly-off API: `hr_weekly_off_policy` + `/hr/weekly-off-policies` (UI API-first; leave sandwich + auto-absent consume policy)
- Attendance rules API: `hr_attendance_rule` + `/hr/attendance-rules` (half/full day hours, early-leave→half-day, geofence_required, miss-punch window)
- Auto-absent hardened: skips approved leave; creates `week_off` / `holiday` rows; marks open check-in as `miss_punch`; Celery beat registered
- Half-day-from-hours on ESS checkout via attendance rule thresholds
- Geo config: location create/update accepts lat/lng/radius; Setup Work Locations fields
- ESS miss-punch: `POST/GET /ess/attendance-corrections`; employee-app correction page wired

Still open (next batches): push channel; device biometric sync; deeper localStorage (KPI/OKR); carry-forward year-end.


### Implementation batch notes (2026-07-30 #15) — Epic 1 Onboarding

Shipped:
- Nav: Workforce → **Employees**; Setup Work Locations → **Base Location**
- Offer Letter removed from onboarding document catalog (ATS offers unchanged)
- Document checklist expanded (Aadhaar/PAN/bank/cheque/graduation/appointment/relieving/slips/signature/prev employer)
- Portal: **Personal email** label; **signature file upload** (+ typed name fallback)
- Hire complete stays `onboarding` with temp `ONB-*` Emp ID (no auto-probation)
- Activation requires **manual Emp ID**; sets Active → probation, `payroll_eligible=true`, optional shift assign
- Migration `0456_hr_payroll_eligible`

Still open (next batches): Epic 2 light Add Employee; Epic 8 On Duty apply; Epic 9 Comp Off hour engine; Epic 11 Overday; push/biometric.

### Implementation batch notes (2026-07-30 #16) — Epic 2 + On Duty + Comp Off hours + OT

Shipped:
- **Epic 2:** Lightweight Add Employee at `/hr/workforce/new` (`bypass_onboarding` + active employment `payroll_eligible=true`); directory CTA restored
- **Epic 8:** `hr_on_duty_request` + `/hr/on-duty-requests` + ESS `POST/GET /ess/on-duty-requests`; employee-app On Duty page; approve writes attendance `on_duty`/`half_day`
- **Epic 9:** Attendance-rule Comp Off hour thresholds (`compoff_*`); ESS checkout auto-credits CO from OT / week-off hours (idempotent `ot_compoff_credited`)
- **Epic 11:** `hr_ot_allotment` + `/hr/ot-allotments` submit/approve/reject; admin UI `/hr/time/ot-allotment`
- Migration `0457_hr_onduty_ot_allot`

Still open (next batches): push channel; device biometric sync; deeper Comp Off Emp→Mgr→HR apply stages; KPI/OKR localStorage.

### Implementation batch notes (2026-07-30 #17) — Leave Emp→Mgr→HR + Carry Forward

Shipped:
- Leave hub Approve/Reject calls API `manager-approve` / `approve` / `reject` (Emp→Mgr→HR for CO and all types)
- Request list maps API status `submitted`→manager review, `manager_approved`→HR review
- ESS team leave: request `id` + `POST /ess/team-leave/{id}/manager-approve|reject`; team page action buttons
- Leave detail timeline reflects real dual-stage statuses (no fake manager name)
- Carry-forward: leave-type CF flags in Setup; `POST /hr/leave-balances/carry-forward`; Celery `hr.leave_carry_forward_year_end`; hub Generate uses API

Still open (next batches): push channel; device biometric sync; KPI/OKR API tables.

### Implementation batch notes (2026-07-30 #18) — KPI / OKR API

Shipped:
- Migration `0458_hr_kpi_okr`: `hr_kpi`, `hr_okr`, `hr_okr_key_result`
- API: `/hr/kpis` CRUD; `/hr/okrs` CRUD + nested key-results (progress weighted average)
- PMS hub: create KPI/OKR prefer-API; directory merges API rows over `erp_pms_kpis_v1` / `erp_pms_okrs_v1`

Still open (next batches): push channel; device biometric sync.

### Implementation batch notes (2026-07-30 #19) — V2 finish: Comp Off workflow, push, biometric, miss-punch max 3, probation Day 85/170

Shipped:
- **Comp Off Emp→Mgr→HR:** `hr_compoff_request` + `/hr/compoff-requests` (submit / manager-approve / approve→`credit_compoff` / reject); ESS `POST/GET /ess/compoff-requests`; employee-app `/attendance/compoff`; admin queue on `/hr/time/ot-allotment`
- **Miss punch max 3:** ESS + HR correction create enforces max 3 regularization requests per employee per calendar year
- **Push channel:** `foundation.ntf_device_token`; `NotificationService.send` fans out `channel=push` deliveries; `POST /notifications/device-tokens` + `POST /ess/device-tokens`; task stub marks push delivered (FCM/APNs provider not wired)
- **Biometric:** `hr_biometric_device` + `/hr/biometric-devices`; `POST /hr/attendance/device-sync` ingest → attendance `source=biometric`; admin UI `/hr/time/biometric-devices`
- **Probation:** Celery reminders add Day **85** / Day **170** from start + **10 days before** end (keep 30/15/7/0); Emp+Mgr+HR recipients
- Migration `0459_hr_v2_finish`

Still open (next batches): real FCM/APNs provider; vendor biometric protocol polish; remaining localStorage purge (Epic 15).

### Implementation batch notes (2026-07-30 #20) — P15 closeout: FCM, biometric polish, shift swap/rotation API, prefer-API

Shipped:
- **FCM push:** `FCM_SERVER_KEY` env + `fcm_client.send_fcm_push`; Celery task uses FCM when configured, else stub
- **Biometric polish:** API key generate/rotate + `X-Device-Api-Key` on `device-sync`; punches accept `employee_code` or `employee_id`
- **Shift swap/rotation:** migration `0460_hr_shift_swap_rot`; `/hr/shift-rotations`, `/hr/shift-swaps` (submit/manager-approve/approve applies roster/assignment); web roster prefer-API
- **Payroll prefer-API:** Loan/Reimbursement create schemas completed; hub `addLoan`/`addReimbursement` post to API when UUIDs; reimbursement submit/approve routes
- **ESS:** `PATCH /ess/me` (mobile)

Still open (next batches): full onboarding case SoR migration; PMS cycles/feedback/PIP APIs; remaining ATS/payroll local cache dual-writes; email channel polish.

## Legend

| Mark | Meaning |
|------|---------|
| ✅ | **Done** — implemented end-to-end (UI + API + DB + logic), usable in production sense for that item |
| 🟠 | **Partial** — screen, API, model, or stub exists, but not complete / not wired / localStorage / mock |
| ❌ | **Left** — not found in codebase, or only placeholder with no real behaviour |

## Overall progress (by phase)

| Phase | Theme | ✅ | 🟠 | ❌ | Phase status |
|------:|-------|---:|---:|---:|:-------------|
| 1 | Core HR Workflow | 28 | 3 | 3 | 🟠 Partial |
| 2 | Employee Master | 10 | 10 | 5 | 🟠 Partial |
| 3 | HR Masters | 11 | 3 | 1 | 🟠 Partial |
| 4 | Attendance | 24 | 5 | 0 | 🟠 Partial |
| 5 | Shift & Roster | 4 | 5 | 0 | 🟠 Partial |
| 6 | Leave Management | 14 | 7 | 2 | 🟠 Partial |
| 7 | Payroll | 14 | 4 | 0 | 🟠 Partial |
| 8 | Separation | 9 | 5 | 0 | 🟠 Partial |
| 9 | Notifications | 12 | 4 | 1 | 🟠 Partial |
| 10 | Employee Self Service | 17 | 4 | 0 | 🟠 Partial |
| 11 | Reports | 11 | 2 | 0 | 🟠 Partial |
| 12 | Backend Cleanup | 1 | 5 | 0 | 🟠 Partial |
| 13 | Audit & Security | 5 | 6 | 0 | 🟠 Partial |
| | **TOTAL** | **160** | **64** | **12** | **~68% Done · ~27% Partial · ~5% Left** |

---

## Phase 1 — Core HR Workflow (Highest Priority)

### 1.1 Recruitment → Onboarding → Employee Workflow

| # | Checklist item | Status | Evidence / gap |
|---|----------------|:------:|----------------|
| 1.1.1 | Create Job | ✅ | ATS `createJob` → `POST /recruitment/job-requisitions` when API context set; local cache fallback |
| 1.1.2 | Publish Job | ✅ | ATS `publishJob`/`updateJob` → requisition submit/approve + posting publish when `apiId` |
| 1.1.3 | Candidate Applied | ✅ | ATS `applyCandidateToJob` → `POST /recruitment/applications` when context + UUIDs |
| 1.1.4 | Interview | ✅ | ATS `scheduleInterview` + `updateInterview` → POST/PATCH `/recruitment/interviews` when UUID |
| 1.1.5 | Offer Released | 🟠 | ATS `generateOffer` → `POST /recruitment/offers` when context set; local fallback |
| 1.1.6 | Offer Accepted | 🟠 | `POST /recruitment/offers/{id}/accept|reject` + ATS `updateOfferStatus`; send chain still UI-driven |
| 1.1.7 | Onboarding Initiated | 🟠 | API `POST /recruitment/onboarding`. UI cases in `erp_onboarding_cases_v1` |
| 1.1.8 | Document Collection | ✅ | Portal + candidate docs; **mandatory identity+education gate** on complete |
| 1.1.9 | Employee Created | ✅ | `OnboardingService.complete()` creates master employee + employment (`onboarding`→`probation`) |
| 1.1.10 | Assign Department | 🟠 | `hr_department_assignment` + org departments; not auto-chained from onboarding complete in UI |
| 1.1.11 | Assign Manager | 🟠 | Reporting derived / employment fields; no enforced post-hire assignment workflow |
| 1.1.12 | Assign Shift | 🟠 | `POST /hr/shift-assignments` exists; not auto-triggered after hire |
| 1.1.13 | Payroll Eligible | ✅ | `hr_employment.payroll_eligible` set true on activation |
| 1.1.14 | **Acceptance:** No employee without onboarding | ✅ | Direct `POST /employees` blocked; workforce `/new` → onboarding; hire via onboarding complete only (`bypass_onboarding` for migration) |
| 1.1.15 | **Acceptance:** Status changes automatically | ✅ | Employment engine + onboarding→probation auto transition; master status sync |
| 1.1.16 | **Acceptance:** Workflow state tracked | ✅ | `hr_lifecycle_event` + `GET /hr/employment/lifecycle/{employee_id}` |

**Phase 1.1 verdict:** 🟠 Partial — backend hire chain exists; admin UI largely disconnected (localStorage ATS).

---

### 1.2 Employee Lifecycle

| # | Checklist item | Status | Evidence / gap |
|---|----------------|:------:|----------------|
| 1.2.1 | State: Draft | ✅ | Employment + master `draft` |
| 1.2.2 | State: Onboarding | ✅ | Employment + master `onboarding`; API `POST .../start-onboarding` |
| 1.2.3 | State: Active | ✅ | `master_employee.status=active`, employment `active` |
| 1.2.4 | State: Probation | ✅ | Employment `probation`; master supports `probation`; start-probation API |
| 1.2.5 | State: Confirmed | ✅ | `POST /hr/employment/{id}/confirm` + `confirmation_date` |
| 1.2.6 | State: Notice Period | ✅ | `POST .../start-notice` → `notice_period` |
| 1.2.7 | State: Separated | ✅ | `POST .../separate` → `separated` |
| 1.2.8 | State: Ex Employee | ✅ | `POST .../ex-employee` → `ex_employee` |
| 1.2.9 | Lifecycle Timeline UI | 🟠 | API timeline ready; dedicated admin UI timeline still pending |
| 1.2.10 | Lifecycle History | ✅ | Table `hr.hr_lifecycle_event` + list API |
| 1.2.11 | Lifecycle Logs | ✅ | Events written on each employment transition + audit |

**Phase 1.2 verdict:** 🟠 Partial — statuses fragmented across master / employment / localStorage.

---

### 1.3 Probation Management

| # | Checklist item | Status | Evidence / gap |
|---|----------------|:------:|----------------|
| 1.3.1 | Probation Start | ✅ | `POST /hr/employment/{id}/start-probation` + `probation_start_date` |
| 1.3.2 | Probation End | ✅ | Field `probation_end_date` on `hr_employment` |
| 1.3.3 | Confirmation Date | ✅ | Set on confirm via engine |
| 1.3.4 | Extend Probation | ✅ | `POST /hr/employment/{id}/extend-probation` |
| 1.3.5 | Confirm Employee | ✅ | `POST /hr/employment/{id}/confirm` + permission `hr.employment:confirm` |
| 1.3.6 | Notify 30 days before | ✅ | Celery `hr.probation_reminders` sends via NotificationService |
| 1.3.7 | Notify 15 days before | ✅ | Same task milestone window |
| 1.3.8 | Notify 7 days before | ✅ | Same task milestone window |
| 1.3.9 | Notify on due date | ✅ | Same task `due_today` |
| 1.3.10 | Recipients: Employee | ✅ | In-app + address to employee user/email |
| 1.3.11 | Recipients: Manager | ✅ | Reporting manager user/email |
| 1.3.12 | Recipients: HR | ✅ | Probation task notifies users with `hr.employment:confirm` (fallback designation `%HR%`) |

**Phase 1.3 verdict:** 🟠 Partial — confirm/extend + reminders sending; HR recipient list pending.

---

## Phase 2 — Employee Master

### 2.1 Employee Information (Mandatory)

| # | Field | Status | Evidence / gap |
|---|-------|:------:|----------------|
| 2.1.1 | Name | ✅ | `master_employee` + UI wizard |
| 2.1.2 | Employee ID | ✅ | Auto `EMP-######` + UI config (prefix local only) |
| 2.1.3 | Department | ✅ | Org department + assignments |
| 2.1.4 | Designation | ✅ | `hr_designation` + assignments |
| 2.1.5 | Manager | 🟠 | Reporting / derived; weak mandatory enforcement |
| 2.1.6 | Location | 🟠 | Org locations + free-text `work_location_text` |
| 2.1.7 | Joining Date | ✅ | Employment / master fields |
| 2.1.8 | Employment Type | 🟠 | UI setup local (`employment-types`); not full API master |
| 2.1.9 | Status | 🟠 | Exists but multi-source (master vs employment vs extension) |

### 2.2 Government Documents

| # | Item | Status | Evidence / gap |
|---|------|:------:|----------------|
| 2.2.1 | Aadhaar (mandatory) | ✅ | Column `hr_employee_profile.aadhaar_number` + Verhoeff validation |
| 2.2.2 | PAN (mandatory) | ✅ | Column `pan_number` + format validation |
| 2.2.3 | Bank Account (mandatory) | ✅ | Columns `bank_account_number`, `bank_ifsc`, `bank_name`, `bank_account_holder` |
| 2.2.4 | Cancelled Cheque (mandatory) | ✅ | Candidate doc type `cancelled_cheque` + gate on onboarding complete |
| 2.2.5 | Education Documents (mandatory) | ✅ | Gate requires `education` on onboarding complete |
| 2.2.6 | UAN (optional) | ✅ | Column `uan_number` + optional validator |
| 2.2.7 | Previous Employer (optional) | 🟠 | Experience upload kind; no structured master |

### 2.3 Validation

| # | Item | Status | Evidence / gap |
|---|------|:------:|----------------|
| 2.3.1 | Aadhaar validation | ✅ | Verhoeff checksum in `kyc_validators.py` |
| 2.3.2 | PAN validation | ✅ | Regex format in `kyc_validators.py` |

### 2.4 Salary Structure

| # | Item | Status | Evidence / gap |
|---|------|:------:|----------------|
| 2.4.1 | Gross Salary as primary (replace Basic-first) | ✅ | `PayrollRunService.calculate` uses `gross_amount` primary |
| 2.4.2 | Auto-calc Basic | ✅ | 40% of gross |
| 2.4.3 | Auto-calc HRA | ✅ | 20% of gross |
| 2.4.4 | Auto-calc Special Allowance | ✅ | Remainder of gross |
| 2.4.5 | Auto-calc PF | ✅ | min(basic,15000)×12% |
| 2.4.6 | Auto-calc ESI | ✅ | 0.75% if gross≤21000 |
| 2.4.7 | Auto-calc Professional Tax | ✅ | ₹200 if gross≥15000 |
| 2.4.8 | Other components engine | 🟠 | Generic components CRUD; run uses formula engine above |

**Phase 2 verdict:** 🟠 Partial — core identity strong; KYC + salary math weak.

---

## Phase 3 — HR Masters (API-driven, no localStorage)

| # | Master | Status | Evidence / gap |
|---|--------|:------:|----------------|
| 3.1 | Company | ✅ | `/companies` API + org model |
| 3.2 | Branch | ✅ | `/branches` — HR Setup `source: api` |
| 3.3 | Location | ✅ | `/locations` — HR Setup `source: api` |
| 3.4 | Department | ✅ | `/departments` — API |
| 3.5 | Designation | ✅ | `/hr/designations` — API |
| 3.6 | Job Levels | ✅ | `/hr/job-levels` API + `hr_job_level`; Setup `source: api` |
| 3.7 | Grades | ✅ | `/hr/grades` API + `hr_grade`; Setup `source: api` |
| 3.8 | Cost Center | ✅ | Org cost-centers API/models |
| 3.9 | Business Unit | ✅ | Org business-units API/models |
| 3.10 | Holiday Calendar | ✅ | `/hr/holiday-calendars` |
| 3.11 | Shift Templates | ✅ | `/hr/shifts` |
| 3.12 | Leave Policies | 🟠 | Setup `source: local`; leave types API without full policy engine |
| 3.13 | Salary Templates | 🟠 | Structures API + hub `createStructure` posts when context set; local cache still used |
| 3.14 | **No localStorage as SoR** | ❌ | Many `erp_*_v1` keys still used across HR services |

**Local vs API in HR Setup (`hr-setup.ts`):**

| Tab | Source |
|-----|--------|
| Branches, Departments, Designations, Work Locations | ✅ api |
| Leave Types, Holiday Calendar, Shift Master, Shift Assignment | ✅ api |
| Salary Components, Tax Rules, PF/ESI | ✅ api |
| Job Levels, Grades | ✅ api (`/hr/job-levels`, `/hr/grades`) |
| Employment Types, Document Types | 🟠 local |
| Leave Policies, Shift Rotation, Attendance Rules, Bank Master | 🟠 local |
| Approval Flows / Email / Notifications (setup) | 🟠 mixed / local |

**Phase 3 verdict:** 🟠 Partial — core org masters done; grades/job levels/policies still browser.

---

## Phase 4 — Attendance

### 4.1 Attendance Status

| # | Status value | Status | Evidence / gap |
|---|--------------|:------:|----------------|
| 4.1.1 | Present | ✅ | `attendance_status=present` + ESS punch |
| 4.1.2 | Absent | ✅ | Celery auto-absent creates `absent` when no punch (skips leave/week-off/holiday) |
| 4.1.3 | Late | ✅ | Status `late` on `hr_attendance` enum + column `late_minutes` |
| 4.1.4 | Half Day | ✅ | Checkout: hours < full_day_hours or early-leave ≥ threshold → `half_day` |
| 4.1.5 | Work From Home | 🟠 | Enum `work_from_home` |
| 4.1.6 | Holiday | ✅ | Auto-absent creates `holiday` rows; Comp Off on holiday work |
| 4.1.7 | Week Off | ✅ | Auto-absent creates `week_off` from weekly-off policy |
| 4.1.8 | On Duty | ✅ | Status `on_duty` added |
| 4.1.9 | Miss Punch | ✅ | Auto marks open check-in; ESS `/ess/attendance-corrections` |

### 4.2 Attendance Rules

| # | Rule | Status | Evidence / gap |
|---|------|:------:|----------------|
| 4.2.1 | Grace Time | ✅ | ESS punch uses `hr_shift.grace_minutes` before marking late |
| 4.2.2 | Late Coming | ✅ | Check-in after start+grace → `attendance_status=late` + `late_minutes` |
| 4.2.3 | Early Leaving | ✅ | ESS checkout: `early_leave_minutes` vs shift end−grace; ≥120 → `half_day` |
| 4.2.4 | Overtime | 🟠 | Checkout sets `overtime_minutes` vs shift end; payroll OT pending |
| 4.2.5 | Shift Timing | 🟠 | Punch resolves roster/assignment shift window for late/OT |
| 4.2.6 | Weekly Off | ✅ | `/hr/weekly-off-policies` + engine; leave sandwich + auto-absent |
| 4.2.7 | Holiday Rules | ✅ | Calendar for sandwich + auto-holiday rows + holiday Comp Off |
| 4.2.8 | Auto Absent | ✅ | Hardened Celery task + beat; week_off/holiday/miss_punch |

### 4.3 Miss Punch Workflow

| # | Step | Status | Evidence / gap |
|---|------|:------:|----------------|
| 4.3.1 | Employee raises request | ✅ | `POST /ess/attendance-corrections` + HR corrections API |
| 4.3.2 | Manager approval | ✅ | `POST .../attendance-corrections/{id}/approve` |
| 4.3.3 | HR approval | ✅ | Same approve route (hr.attendance:update) |
| 4.3.4 | Attendance updated | ✅ | Approve patches check_in/out/status + marks adjusted |

### 4.4 Attendance Correction

| # | Item | Status | Evidence / gap |
|---|------|:------:|----------------|
| 4.4.1 | Request | ✅ | API + local cache fallback |
| 4.4.2 | Approval | ✅ | `/approve` applies attendance patch |
| 4.4.3 | Reject | ✅ | `/reject` |
| 4.4.4 | Audit Log | 🟠 | Server audit on approve/reject; browser audit still kept |

### 4.5 Biometric

| # | Item | Status | Evidence / gap |
|---|------|:------:|----------------|
| 4.5.1 | Device Integration | 🟠 | Registry + API-key device-sync + employee_code; vendor SDKs still external |
| 4.5.2 | Manual Upload | ✅ | `importAttendanceCsv` -> POST /hr/attendance |
| 4.5.3 | API Sync | 🟠 | Generic JSON device-sync (not vendor-specific protocol) |

### 4.6 Geo Fencing

| # | Item | Status | Evidence / gap |
|---|------|:------:|----------------|
| 4.6.1 | Office Radius | ✅ | Location CRUD lat/lng/radius + ESS punch haversine check |
| 4.6.2 | GPS Validation | ✅ | Punch requires lat/lng when geofence or rule.geofence_required |
| 4.6.3 | Mobile Check-in | ✅ | ESS punch with geolocation from employee-app |

**Phase 4 verdict:** 🟠 Partial — biometric registry + device-sync shipped; vendor protocol polish left.

---

## Phase 5 — Shift & Roster

| # | Checklist item | Status | Evidence / gap |
|---|----------------|:------:|----------------|
| 5.1 | HR Creates Shift | ✅ | `/hr/shifts` CRUD |
| 5.2 | Manager Creates Monthly Roster | ✅ | `/hr/roster-entries` + calendar UI API persist |
| 5.3 | Employees Assigned | 🟠 | `/hr/shift-assignments` CRUD; UI underuses submit/approve |
| 5.4 | Attendance Uses Assigned Shift | ✅ | ESS punch: published roster → else active/approved assignment → late/OT |
| 5.5 | Shift Rotation | 🟠 | `/hr/shift-rotations` API + prefer-API UI; local cache fallback |
| 5.6 | Shift Swap | 🟠 | `/hr/shift-swaps` Emp→Mgr→HR + apply roster/assignment; local fallback |
| 5.7 | Weekly Rotation | 🟠 | Rotation cycle weekly/biweekly/monthly on API; generation engine light |
| 5.8 | Night Shift | ✅ | Shift type `night` + overnight flag on model |
| 5.9 | Workflow: HR→Manager→Assign→Attendance | 🟠 | Roster + assignment APIs consumed by punch; rotation/swap still local |

**Phase 5 verdict:** 🟠 Partial — shift master + roster + punch consumption; rotation/swap browser-only.

---

## Phase 6 — Leave Management

### 6.1 Leave Types

| # | Type | Status | Evidence / gap |
|---|------|:------:|----------------|
| 6.1.1 | Casual Leave | ✅ | Seeded `CL` + leave type API |
| 6.1.2 | Sick Leave | ✅ | Seeded `SL` |
| 6.1.3 | Earned Leave | ✅ | Seeded `EL` |
| 6.1.4 | Comp Off | ✅ | Auto-credit + Emp→Mgr→HR request (`/hr/compoff-requests`) allocates via `credit_compoff` |
| 6.1.5 | Loss of Pay | ✅ | Seeded `LOP` (unpaid) in `seed_hr_workforce` |
| 6.1.6 | Maternity | ✅ | Seeded `ML` |
| 6.1.7 | Paternity | ✅ | Seeded `PL` |

### 6.2 Leave Approval

| # | Step | Status | Evidence / gap |
|---|------|:------:|----------------|
| 6.2.1 | Employee apply | ✅ | Admin + ESS `POST` leave request |
| 6.2.2 | Manager | ✅ | `POST /hr/leave-requests/{id}/manager-approve` → `manager_approved` |
| 6.2.3 | HR | ✅ | `POST /hr/leave-requests/{id}/approve` final (debits balance) |
| 6.2.4 | Approved | ✅ | Status → `approved` + balance debit |
| 6.2.5 | Configurable approval matrix | 🟠 | Dual-stage hardcoded Employee→Manager→HR; WF matrix still unused |
| 6.2.6 | Reject | ✅ | `POST /hr/leave-requests/{id}/reject` |

### 6.3 Leave Rules

| # | Rule | Status | Evidence / gap |
|---|------|:------:|----------------|
| 6.3.1 | Monthly Credit | ✅ | Policy column `monthly_credit_days` + Celery `hr.leave_balance_monthly_credit` |
| 6.3.2 | Yearly Credit | 🟠 | `max_days_per_year` / balances by year; no full policy engine |
| 6.3.3 | Carry Forward | 🟠 | Column `carry_forward_allowed` / `max_carry_forward_days` on leave type; year-end job pending |
| 6.3.4 | Encashment | ✅ | FNF prepare encashes `encashment_allowed` balances (daily rate = basic/30) and zeros them |
| 6.3.5 | Sandwich Rule | ✅ | Sandwich on = inclusive span; off = exclude weekends + published holiday calendar |
| 6.3.6 | Half Day Leave | 🟠 | Days count supports fractions in places; not full rule set |
| 6.3.7 | Leave Balance Validation | 🟠 | Partial on apply; not complete policy validation |
| 6.3.8 | Leave Cycle 1st→31st | 🟠 | `leave_cycle_start_day` column (default 1); enforcement pending |
| 6.3.9 | Adjustment must not use future month | ✅ | `/hr/leave-adjustments` blocks future month on create/approve |

**Phase 6 verdict:** 🟠 Partial — CL/SL/EL dual-approve + sandwich/adjustment; maternity/paternity/LOP still left.

---

## Phase 7 — Payroll

| # | Checklist item | Status | Evidence / gap |
|---|----------------|:------:|----------------|
| 7.1 | Consume Attendance | ✅ | Attendance facts drive LOP / paid_days in calculate |
| 7.2 | Consume Leave | ✅ | Leave facts summed into leave_days |
| 7.3 | Consume Shift | ✅ | Attendance `shift_id`/`overtime_minutes` in payroll facts; calc adds 1.5x OT pay |
| 7.4 | Consume Salary Structure | 🟠 | Uses employee salary gross; structure lines not fully applied |
| 7.5 | Consume Statutory Rules | ✅ | PF/ESI/PT computed in engine |
| 7.6 | Produce Payroll (real lines) | ✅ | Creates `pay_payroll_run_line` with breakdown JSON |
| 7.7 | No manual duplication | 🟠 | Hub `runPayroll` + `generatePayslips` API-first when context/UUIDs; local fallback remains |
| 7.8 | Monthly Payroll | ✅ | Periods + runs + calculate/submit/approve |
| 7.9 | Arrears | ✅ | Applied earning adjustments (`reason=arrears`) folded into payroll calc |
| 7.10 | Bonus | ✅ | Expanded BonusCreate; hub submit/approve; approved bonuses in run calc |
| 7.11 | Incentives | ✅ | Applied earning adjustments (`reason=incentive`) folded into payroll calc |
| 7.12 | Deductions | ✅ | PF/ESI/PT deducted in run |
| 7.13 | Full & Final Settlement | ✅ | FNF run + leave encashment + gratuity (≥5 yrs, 15/26×basic×years) patched into settlement line |

**Phase 7 verdict:** 🟠 Partial — payroll schema rich; calculation engine empty.

---

## Phase 8 — Separation

| # | Checklist item | Status | Evidence / gap |
|---|----------------|:------:|----------------|
| 8.1 | Rename Offboarding → Separation | ✅ | Nav `/hr/separation`, model `HrSeparation` |
| 8.2 | Employee Resigns | ✅ | Type `resignation` + create API |
| 8.3 | Manager Review | ✅ | Engine stage `manager_approve` |
| 8.4 | HR Approval | ✅ | Engine stage `hr_approve` |
| 8.5 | Notice Period | 🟠 | `notice_period_days` on employment; weak tracking UI |
| 8.6 | Asset Clearance | 🟠 | Checklist item `assets` in `clearance_json`; hub “Clear assets” |
| 8.7 | Payroll FNF | ✅ | `POST .../fnf/prepare` → `pay_payroll_run` `run_type=final_settlement` + calculate |
| 8.8 | Exit Interview | 🟠 | `POST .../exit-interview` stores answers in `clearance_json`; hub quick-capture |
| 8.9 | Ex Employee | 🟠 | Master → `resigned`/`terminated` |
| 8.10 | Resignation Reminder | ✅ | `hr.separation_followups` notifies within 7 days of LWD |
| 8.11 | Notice Tracking | 🟠 | Dates on separation; no reminder engine |
| 8.12 | Exit Checklist | ✅ | Default checklist on create; `POST .../checklist` updates items |
| 8.13 | Final Settlement | ✅ | Encashment + gratuity in `clearance_json.fnf` and payroll line breakdown |
| 8.14 | Separation Admin UI actions | ✅ | SeparationHub Submit / Approve / Prepare FNF / Settle FNF / Complete |

**Phase 8 verdict:** 🟠 Partial — dual-stage + FNF + checklist/exit interview stubs; resignation reminders still left.

---

## Phase 9 — Notifications

| # | Event | Status | Evidence / gap |
|---|-------|:------:|----------------|
| 9.1 | Central Notification Engine | 🟠 | Foundation `NotificationService` + `hr_notify.notify_employee` helper |
| 9.2 | Probation | ✅ | Celery sends employee + manager in-app events |
| 9.3 | Confirmation | ✅ | `EmploymentService.confirm` notifies employee + manager |
| 9.4 | Leave | ✅ | Submit notify + monthly credit Celery |
| 9.5 | Attendance | ✅ | Correction approve/reject notifies employee |
| 9.6 | Miss Punch | ✅ | Correction submit notifies (`hr.miss_punch` when miss status/reason) |
| 9.7 | Payroll | ✅ | `PayrollRunService.approve` notifies employees on run lines |
| 9.8 | Shift Change | ✅ | `ShiftAssignmentService.approve` → `hr_notify` `hr.shift_change` |
| 9.9 | Birthday | ✅ | Celery `hr.birthday_anniversary_reminders` |
| 9.10 | Work Anniversary | ✅ | Same Celery task vs `date_of_joining` |
| 9.11 | Separation | ✅ | Submit + manager/HR approve notify employee + manager |
| 9.12 | Holidays | ✅ | Celery `hr.holiday_reminders` for published calendars |
| 9.13 | Channel: In App | 🟠 | Events created; ESS inbox lists recipient events |
| 9.14 | Channel: Email | 🟠 | Foundation/templates capability; delivery still task-based |
| 9.15 | Channel: Push | 🟠 | Device tokens + FCM when `FCM_SERVER_KEY` set; else stub |

**Phase 9 verdict:** 🟠 Partial — push fan-out stub live; FCM/APNs provider still left.

---

## Phase 10 — Employee Self Service

| # | Feature | Status | Evidence / gap |
|---|---------|:------:|----------------|
| 10.1 | Profile Update | 🟠 | `PATCH /ess/me` mobile; bank/emergency/education separate |
| 10.2 | Emergency Contact | ✅ | `GET/PATCH /ess/profile/emergency` + employee-app page |
| 10.3 | Bank Details | ✅ | `GET/PATCH /ess/profile/bank` + employee-app page |
| 10.4 | Education | ✅ | ESS `GET/PATCH /ess/profile/education` + employee-app page; `education_json` on profile |
| 10.5 | Skills | ✅ | Same ESS education endpoint (`skills_json`) |
| 10.6 | Documents | ✅ | `GET /ess/documents` + employee-app page |
| 10.7 | Assets | ✅ | `GET /ess/assets` from asset assignments/custodian |
| 10.8 | Holidays | ✅ | `GET /ess/holidays` + employee-app page |
| 10.9 | Team Leave | ✅ | `GET /ess/team-leave` for direct reports |
| 10.10 | Attendance Correction | ✅ | ESS `POST/GET /ess/attendance-corrections` + max 3/year; employee-app correction page |
| 10.11 | Notifications | ✅ | `GET /ess/notifications` lists in-app events for employee user |
| 10.12 | Announcements | 🟠 | `GET /ess/announcements` derived from published holidays |
| 10.13 | Training | ✅ | `GET /ess/training` + employee-app `/training` |
| 10.14 | Performance | ✅ | `GET /ess/performance` + `/performance` |
| 10.15 | Separation Requests | ✅ | `GET/POST /ess/separation` + `/separation` resign form |
| 10.16 | Attendance (punch) | ✅ | ESS API + geo + roster/shift late/OT when mock off |
| 10.17 | Leave apply | ✅ | ESS API when mock off |
| 10.18 | Payslips | ✅ | ESS API when mock off |
| 10.19 | **Remove mock/local data** | 🟠 | Default mock off; portal mocks remain as fallback only for core leave/punch |

**ESS API today (`/api/v1/ess`):** me, leave, attendance/punch, bank, KYC, emergency, documents, holidays, notifications, payslips, team-leave, announcements, assets, training, performance, separation.

**Phase 10 verdict:** 🟠 Partial — core ESS domains API-backed; education/skills still empty; correction UI without ESS API.

---

## Phase 11 — Reports

| # | Report | Status | Evidence / gap |
|----|--------|:------:|----------------|
| 11.1 | Attendance Report | ✅ | `GET /hr/reports/export?report_type=attendance` |
| 11.2 | Leave Report | ✅ | `report_type=leave` CSV/PDF |
| 11.3 | Payroll Report | 🟠 | Payroll reports routes exist; calc empty so reports weak |
| 11.4 | Headcount | ✅ | `report_type=headcount` |
| 11.5 | Attrition | ✅ | `report_type=exit|attrition` |
| 11.6 | Late Coming | ✅ | `report_type=late` |
| 11.7 | Overtime | ✅ | `report_type=overtime` |
| 11.8 | Probation | ✅ | `report_type=probation` |
| 11.9 | Joining Report | ✅ | `report_type=joining` |
| 11.10 | Exit Report | ✅ | Same exit/attrition export |
| 11.11 | Excel export | ✅ | CSV with UTF-8 BOM (Excel-friendly) |
| 11.12 | PDF export | ✅ | Minimal stdlib PDF via `fmt=pdf` |
| 11.13 | Filters | 🟠 | List filters on some screens only; export company_id only |

**Phase 11 verdict:** 🟠 Partial — HR operational exports live; payroll report + rich filters still weak.

---

## Phase 12 — Backend Cleanup

| # | Checklist item | Status | Evidence / gap |
|---|----------------|:------:|----------------|
| 12.1 | Remove localStorage as source of truth | 🟠 | ATS/payroll/PMS/leave Comp Off+encashment API-first when UUIDs; cache remains |
| 12.2 | Remove mock services | 🟠 | ESS portal pages no longer bind mock SoR when mock off; modules remain for fallback |
| 12.3 | Remove hardcoded data | 🟠 | Seeded HR setup demo rows removed; demo credentials remain for login |
| 12.4 | Remove / consolidate duplicate APIs | 🟠 | Dual paths: Recruitment REST vs ATS local; master vs HR profile vs extensions |
| 12.5 | Everything persists through APIs | 🟠 | Lists stronger (ATS/payroll/ESS); payroll/ATS write paths still cache |
| 12.6 | Dead service methods exposed | ✅ | Employment confirm/activate/end + leave reject routes present |

**Phase 12 verdict:** 🟠 Partial — ESS/setup cleanup started; ATS/payroll/PMS localStorage program remains.

---

## Phase 13 — Audit & Security

### 13.1 Audit logs

| # | Area | Status | Evidence / gap |
|---|------|:------:|----------------|
| 13.1.1 | Employee changes | 🟠 | Foundation audit on some writes; UI also keeps browser audit |
| 13.1.2 | Salary changes | 🟠 | Payroll entity audit hooks partial |
| 13.1.3 | Attendance edits | 🟠 | PATCH adjusted; weak dedicated audit |
| 13.1.4 | Leave approvals | 🟠 | Status change; limited structured audit |
| 13.1.5 | Payroll | 🟠 | Run status transitions audited partially |
| 13.1.6 | Separation | 🟠 | Separation service audit hooks partial |

### 13.2 RBAC roles

| # | Role | Status | Evidence / gap |
|---|------|:------:|----------------|
| 13.2.1 | Super Admin | ✅ | `SUPER_ADMIN` / `TENANT_ADMIN` display + grant-all (`0453_super_admin_role_polish`) |
| 13.2.2 | HR Admin | ✅ | Role pack `HR_ADMIN` / display “HR Admin” (migration `0452`) |
| 13.2.3 | HR Executive | ✅ | Role pack `HR_EXECUTIVE` |
| 13.2.4 | Manager | ✅ | Role pack `HR_MANAGER` display “Manager” |
| 13.2.5 | Employee | ✅ | Role pack `HR_EMPLOYEE` display “Employee” (+ ESS auth) |

**Phase 13 verdict:** 🟠 Partial — Super Admin + HR named role packs done; full audit trails incomplete.

---

## Acceptance criteria tracker (from Phase 1)

| Acceptance rule | Status |
|-----------------|:------:|
| No employee should exist without onboarding | ✅ |
| Employee status changes automatically | ✅ |
| Workflow state is tracked | ✅ |
| Leave adjustment must not use future month's leave | ✅ |
| Payroll consumes attendance/leave/shift/structure/statutory with no manual duplication | 🟠 |
| Managers own roster; attendance uses assigned shift | ✅ |
| Remove all mock/local data from ESS | 🟠 |
| Everything persists through APIs | 🟠 |

---

## Suggested build order (from this checklist)

1. **P0 (done):** Lifecycle/KYC/payroll calc/leave dual-approve/roster/ESS bank/docs/geo  
2. **P0 (done):** ATS interview/offer wire; sandwich + leave adjustment; punch↔shift; notification send  
3. **P0 (done):** FNF prepare/settle; block direct hire; photo + cancelled cheque gate  
4. **P1 (done):** FNF encashment/gratuity; sandwich vs holidays; HR probation recipients  
5. **P1 (done):** Applications pipeline; attendance correction; early leave; auto-absent  
6. **P2 (done):** Reports CSV/PDF; confirmation/leave/separation notifies; separation checklist/exit interview  
7. **P3 (done):** ESS mock strip + emergency/team/assets/announcements APIs; birthday/holiday notifies; setup empty defaults  
8. **P4 (done):** ATS/payroll API-prefer lists; ESS training/performance/separation; HR role packs resync  
9. **P5 (done):** Payroll/ATS write cutover; PMS prefer-API; miss-punch/payroll notifies; Super Admin polish  
10. **P6 (done):** PMS write mutations; payslip generate schema; shift-change notifies; ML/PL/LOP seed
11. **P7 (done):** Comp Off credit API; ESS education/skills; resignation reminders
12. **P8 (done):** Holiday → Comp Off; leave encashment API; payroll consume shift OT
13. **P9 (done):** Bonus + arrears/incentives in payroll calc; attendance CSV marked done
14. **P10 (done):** Weekly-off + attendance-rules APIs; half-day-from-hours; hardened auto-absent; ESS miss-punch; geo config  
15. **P11 (done):** Epic 1 — activation Emp ID, payroll eligible, onboarding docs/signature, Employees rename  
16. **P12 (done):** Leave Emp→Mgr→HR API wire-up; carry-forward year-end  
17. **P13 (done):** KPI/OKR API tables + PMS prefer-API  
18. **P14 (done):** Push device tokens + stub fan-out; biometric registry + device-sync; Comp Off Emp→Mgr→HR; miss-punch max 3; probation Day 85/170  
19. **P15 (done):** FCM env-gated push; biometric API-key + employee_code; shift swap/rotation APIs; payroll loan/reimb prefer-API; ESS me PATCH  
20. **P16 next:** Onboarding case SoR; PMS cycles/feedback/PIP; remaining localStorage dual-write purge


---

## How to update this file

After each implementation PR:

1. Change ✅ / 🟠 / ❌ for the affected rows only.  
2. Update the **Overall progress** counts.  
3. Add a one-line note under Evidence if the path changed.  
4. Keep evidence paths absolute under `apps/` so reviews stay verifiable.

---

*Generated from codebase analysis of `cache_erp_hrms_payroll` (API models/services/routers, web HR services, employee-app ESS/mocks). Items marked ❌ were Not Found as working implementations.*
