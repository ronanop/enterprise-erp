# BRD — Human Resource Management System (HRMS) & Payroll

| Attribute | Value |
|-----------|-------|
| **Document ID** | BRD-HRMS-PAY-v1.0 |
| **Product** | Enterprise ERP Platform |
| **Domains** | HR (FRD-09) · Payroll (FRD-10) |
| **Version** | 1.0 |
| **Status** | Draft for Business Review |
| **Date** | 23 July 2026 |
| **Upstream** | [ERP_BRD_v1.0.md](./ERP_BRD_v1.0.md) |
| **Downstream** | [FRD-09-HR-Domain.md](../02_FRD/FRD-09-HR-Domain.md), [FRD-10-Payroll-Domain.md](../02_FRD/FRD-10-Payroll-Domain.md) |
| **Flows & diagrams** | [FLOW-HRMS-Payroll-Diagrams-v1.0.md](./FLOW-HRMS-Payroll-Diagrams-v1.0.md) — all arrow flows in one file |

---

## 1. Executive Summary

This Business Requirements Document defines the **complete HRMS and Payroll** capability for the Enterprise ERP Platform.

HRMS manages the **people lifecycle** — from requisition and hiring through attendance, leave, shifts, performance, training, and exit.

Payroll manages the **compensation lifecycle** — salary structures, monthly processing, statutory deductions, payslips, bank transfer, and finance posting.

Together they form an integrated **People → Time → Pay → Finance** value chain.

### Business Outcomes

| Outcome | Description |
|---------|-------------|
| Single employee master | One source of truth for workforce across HR, Payroll, Finance |
| Accurate pay | Attendance, leave, and OT feed payroll automatically |
| Compliance | PF, ESI, PT, TDS, labour statutes tracked and auditable |
| Manager productivity | Self-service leave, attendance corrections, approvals |
| Audit readiness | Who changed what, when — for every HR/Payroll action |

---

## 2. Scope

### 2.1 In Scope — HRMS

| Module | Business Capability |
|--------|---------------------|
| HR Setup | Org units, designations, leave types, holidays, policies |
| Recruitment | Requisitions, candidates, interviews, offers |
| Onboarding | Joining checklist, documents, system access |
| Employee Management | Profiles, employment, documents, lifecycle status |
| Attendance | Daily punches, corrections, OT, missing punches |
| Leave | Policies, balances, requests, approvals, CF, encashment |
| Shift & Roster | Shift master, assignments, rotations, roster calendar |
| Performance | Goals, reviews, appraisals |
| Learning / Training | Programs, enrollments, attendance |
| Separation | Resignation, clearance, final settlement inputs |
| ESS (Portal) | Employee self-service for leave, attendance, payslip |

### 2.2 In Scope — Payroll

| Module | Business Capability |
|--------|---------------------|
| Salary Structure | Components, grades, CTC breakdown |
| Payroll Run | Period close, attendance/leave inputs, calculation |
| Allowances / Deductions | Recurring and one-time |
| Loans & Advances | EMI recovery in payroll |
| Tax | Regime selection, TDS computation |
| Payslip | Generation and employee access |
| Bank Transfer | Payment file / advice |
| Finance Posting | GL journal to Finance module |

### 2.3 Out of Scope (this BRD)

- Full ATS with external job boards (phase 2)
- Biometric hardware drivers (integrate via adapters)
- Benefits brokerage / insurance underwriting
- Legal case management beyond separation checklist

---

## 3. Stakeholders & Personas

| Persona | Primary Needs |
|---------|---------------|
| HR Admin | Setup masters, employee records, policy enforcement |
| HR Manager | Approvals, reports, headcount, compliance |
| Reporting Manager | Team leave/attendance approvals, roster |
| Payroll Officer | Run payroll, validate inputs, publish payslips |
| Finance Controller | Payroll journal, cost centers, statutory remittance |
| Employee (ESS) | Apply leave, view balance, payslip, attendance |
| Recruiter | Requisitions, candidates, offers |
| System Admin | Roles, permissions (`hr.*`, `payroll.*`) |

---

## 4. Master End-to-End Value Chain

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                     COMPLETE HRMS + PAYROLL FLOW                         │
└──────────────────────────────────────────────────────────────────────────┘

  RECRUIT          HIRE            WORKFORCE         TIME & ATTENDANCE
     │               │                 │                     │
     ▼               ▼                 ▼                     ▼
 Job Requisition → Offer → Onboard → Employee Master → Shift / Roster
     │               │                 │                     │
     │               │                 │                     ▼
     │               │                 │              Attendance Marking
     │               │                 │                     │
     │               │                 │                     ▼
     │               │                 │              Leave Requests
     │               │                 │                     │
     │               │                 ▼                     │
     │               │          Performance / Training       │
     │               │                 │                     │
     │               │                 ▼                     ▼
     │               │            Separation ──────┐   Payroll Inputs
     │               │                             │         │
     ▼               ▼                             ▼         ▼
 Candidate ───► Joining ─────────────────────► Final Settlement
                                                         │
                                                         ▼
                                              ┌─────────────────────┐
                                              │      PAYROLL        │
                                              │  Structure → Run →  │
                                              │  Approve → Payslip  │
                                              │  → Bank → Finance   │
                                              └─────────────────────┘
```

### Arrow Flow (Linear Lifecycle)

```text
Job Requisition
      ↓
   Candidate
      ↓
   Interview
      ↓
     Offer
      ↓
   Onboarding
      ↓
Employee Master (Workforce)
      ↓
┌─────┴──────┬──────────────┬──────────────┐
↓            ↓              ↓              ↓
Shift     Attendance      Leave      Performance
Roster       ↓              ↓              ↓
      └──────┴──────┬───────┘              │
                    ↓                      │
            Payroll Processing ←───────────┘
                    ↓
            Payslip + Bank Transfer
                    ↓
            Finance GL Posting
                    ↓
            Separation / Full & Final (when exit)
```

---

## 5. Module-Level Business Flows

### 5.1 Recruitment → Hire

```text
Department raises Job Requisition
      ↓
HR / Hiring Manager approves
      ↓
Requisition OPEN
      ↓
Candidates sourced & screened
      ↓
Interview rounds (schedule → feedback)
      ↓
Offer drafted → approved → sent
      ↓
Candidate accepts
      ↓
Onboarding checklist opened
      ↓
Employee created in Workforce (EMP-######)
```

**Business rules**

- Requisition number format: `REQ-YYYY-######`
- Offer cannot be sent without approved requisition
- Employee ID is never a database ObjectId — business code only

### 5.2 Employee Management (Workforce)

```text
Add Employee (7-step wizard)
  1 Personal → 2 Employment → 3 Gov IDs → 4 Bank
  → 5 Salary (optional) → 6 Documents → 7 Review
      ↓
Master Employee + HR Profile + Employment created
      ↓
Profile 360° (Overview, Docs, Attendance, Leave, Payroll tabs)
      ↓
Lifecycle: Active | Probation | Notice | Inactive | Archived
```

**Business rules**

- Soft delete only (Archive)
- Unique: official email, mobile, PAN, Aadhaar, employee code
- Audit: created/updated by, field-level change log

### 5.3 Shift & Roster

```text
Create Shift Master (SHIFT-001…)
      ↓
Assign Shift (Permanent / Temporary / Rotation)
      ↓
Optional: Create Rotation Cycle (Morning → Evening → Night → Off)
      ↓
Roster Calendar (Weekly / Monthly) — drag & drop
      ↓
Shift Swap Request → Manager → HR → Approved
      ↓
Roster feeds Attendance & Overtime rules
```

### 5.4 Attendance Management

```text
Punch / Mark Attendance (Manual | Biometric | Mobile | Web | QR | Face)
      ↓
Validate vs Shift + Grace + Holiday + Weekly Off
      ↓
Status: Present | Absent | Late | Half Day | WFH | Leave | Missed Punch…
      ↓
Auto OT: Normal hours → OT → Double OT
      ↓
Correction Request → Manager → HR → Approved
      ↓
Lock period → Payroll attendance facts
```

### 5.5 Leave Management

```text
Employee applies leave (type, dates, session, attachment)
      ↓
Auto validation
  • Balance · Holidays · Weekly offs · Overlaps
  • Probation · Gender · Policy eligibility
      ↓
Workflow: Employee → Manager → HR → [Director] → Approved
      ↓
Balance updated (Used / Pending / Available)
      ↓
Optional: Comp-off | Carry Forward | Encashment
      ↓
Approved leave excluded from payroll LOP
```

### 5.6 Performance & Training

```text
Goals / KPIs set
      ↓
Review cycle opened
      ↓
Self + Manager appraisal
      ↓
Rating finalized → optional increment input to Payroll

Training program created
      ↓
Employees enrolled
      ↓
Training attendance → completion certificate
```

### 5.7 Separation

```text
Resignation / Termination / Retirement initiated
      ↓
Manager → HR approval
      ↓
Exit checklist (assets, KT, access revoke)
      ↓
Last working day + notice settlement
      ↓
Full & Final → Payroll final run → Archive employee
```

### 5.8 Payroll Processing (Core)

```text
Payroll period opened (e.g. Apr-2026)
      ↓
Pull inputs from HR
  • Attendance days / OT
  • Leave / LOP
  • Salary structure & components
  • Loans EMI / advances
  • One-time allowances / deductions
      ↓
Calculate gross → statutory → net
      ↓
Payroll Officer review
      ↓
Approval workflow (Payroll Head → Finance)
      ↓
Generate payslips
      ↓
Bank payment file
      ↓
Post payroll journal to Finance GL
      ↓
Period locked (immutable except authorized reversal)
```

### 5.9 Payroll ↔ Finance Integration

```text
Payroll Run APPROVED
      ↓
Generate journal lines
  Dr  Salary Expense / Employer PF / etc.
  Cr  Payable / PF Payable / TDS Payable / Bank
      ↓
Finance posts journal (tenant isolation + audit)
      ↓
Statutory remittance tracked in Finance / GRC reports
```

---

## 6. Cross-Module Integration Map

```text
                    ┌─────────────┐
                    │ Organization│
                    │ Company/Branch│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Master Data │
                    │ Employees   │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │    HR    │──►│ Payroll  │──►│ Finance  │
     └────┬─────┘   └────┬─────┘   └──────────┘
          │              │
          ├─ Attendance ─┤
          ├─ Leave ──────┤
          ├─ Shifts ─────┤
          └─ Separation ─┘

Supporting engines (platform):
  Workflow · Notification · Audit · RBAC · Document Storage
```

---

## 7. Functional Requirements Summary

### 7.1 HRMS Must-Have (P0)

| ID | Requirement |
|----|-------------|
| HR-BR-01 | Maintain employee master with configurable EMP ID |
| HR-BR-02 | Capture attendance with multi-source punches and corrections |
| HR-BR-03 | Manage leave types, balances, approvals, holidays |
| HR-BR-04 | Define shifts, assignments, and monthly roster |
| HR-BR-05 | Soft-archive employees; never hard-delete business records |
| HR-BR-06 | Enforce RBAC on all HR APIs (`hr.*`) |
| HR-BR-07 | Audit log for create/update/approve/cancel actions |
| HR-BR-08 | Expose attendance/leave facts to Payroll (read-only contract) |

### 7.2 Payroll Must-Have (P0)

| ID | Requirement |
|----|-------------|
| PY-BR-01 | Maintain salary structures and earnings/deduction components |
| PY-BR-02 | Run payroll for a period using HR attendance/leave inputs |
| PY-BR-03 | Compute statutory deductions (PF/ESI/PT/TDS as configured) |
| PY-BR-04 | Generate payslips and bank payment advice |
| PY-BR-05 | Post approved payroll to Finance GL |
| PY-BR-06 | Lock closed payroll periods |
| PY-BR-07 | RBAC (`payroll.*`) and full audit trail |

### 7.3 Should-Have (P1)

| ID | Requirement |
|----|-------------|
| HR-BR-09 | Recruitment → offer → onboarding funnel |
| HR-BR-10 | Performance reviews and training enrollments |
| HR-BR-11 | Comp-off, leave encashment, carry forward |
| HR-BR-12 | Shift swap and rotation cycles |
| PY-BR-08 | Loans/advances EMI recovery |
| PY-BR-09 | Employee ESS payslip download |

---

## 8. Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| Multi-tenant | `tenant_id`, `company_id`, `branch_id` on transactional tables |
| Security | JWT auth; permission-gated APIs; no UI→DB direct access |
| Audit | Soft delete; version columns; immutable payroll after lock |
| Performance | Dense admin UI; pagination on all list screens |
| Compliance | India-first statutory (PF/ESI/PT/TDS); extensible country packs |
| Availability | Payroll run must be resumable / retry-safe for large headcount |
| UX | Enterprise drawers, calendars, skeletons, empty states |

---

## 9. Approval Workflows (Arrow Diagrams)

### Leave

```text
Employee
   ↓
Reporting Manager ──reject──► Rejected
   ↓ approve
HR ──reject──► Rejected
   ↓ approve
[Director optional]
   ↓
Approved → Balance updated → Notify employee
```

### Attendance Correction

```text
Employee
   ↓
Manager
   ↓
HR
   ↓
Approved → Attendance adjusted → Audit logged
```

### Payroll Run

```text
Payroll Officer (Draft run)
   ↓
Payroll Manager (Review)
   ↓
Finance Controller (Approve posting)
   ↓
Payslip published + Bank file + GL posted
```

### Separation

```text
Initiator (Employee / HR)
   ↓
Manager
   ↓
HR
   ↓
Clearance complete
   ↓
Full & Final payroll
   ↓
Employee Archived
```

---

## 10. Data & System Boundaries

| System | Owns | Consumes |
|--------|------|----------|
| Master Data | Employee identity, department, manager | — |
| HR | Profile, employment, attendance, leave, shifts, docs | Master employee |
| Payroll | Structures, runs, payslips, tax | HR attendance/leave facts, employee bank |
| Finance | GL journals, payables | Payroll posting payload |
| Foundation | Auth, RBAC, workflow, notifications, audit | All modules |

**Forbidden:** Payroll must not write HR attendance; HR must not post GL journals directly.

---

## 11. Reports & Analytics (Business View)

### HRMS

- Headcount / attrition  
- Attendance daily/monthly / late / missing punch  
- Leave balance / pending approvals / department leave  
- Shift utilization / night shift / roster compliance  

### Payroll

- Payroll register  
- Department cost  
- Statutory liability (PF/ESI/TDS)  
- Bank transfer summary  
- Variance vs prior month  

---

## 12. Success Metrics (KPIs)

| KPI | Target Direction |
|-----|------------------|
| Payroll accuracy | ≥ 99.5% payslips without correction |
| Leave approval SLA | ≤ 2 business days manager action |
| Attendance capture completeness | ≥ 98% punches before lock |
| Time to hire (req → offer) | Track & reduce MoM |
| ESS adoption | ≥ 70% leave applications via self-service |
| Audit findings on people data | Zero critical on soft-delete / access |

---

## 13. Assumptions & Dependencies

1. Organization (company/branch) and Master Employee exist before HR transactions.  
2. Workflow and Notification engines are available for approvals/alerts.  
3. Finance Chart of Accounts includes payroll expense/payable accounts.  
4. Statutory rates are configurable per FY (not hard-coded).  
5. Biometric devices integrate via API adapters — not in core UI.

---

## 14. Risks

| Risk | Mitigation |
|------|------------|
| Incorrect attendance → wrong pay | Lock attendance before payroll; correction cut-off |
| Duplicate employee codes | Company-scoped unique constraint + ID generator |
| Mid-period structure change | Effective-dated salary structures |
| Partial payroll failure | Batch with checkpoint / retry; period not close until success |
| Privacy of bank/Aadhaar | Mask in UI; encrypt at rest; RBAC |

---

## 15. Phased Delivery Roadmap

| Phase | Scope |
|-------|-------|
| **Phase 1** | Employee, Attendance, Leave, Shifts, basic Payroll run + payslip |
| **Phase 2** | Recruitment, Onboarding, Comp-off/CF/Encashment, Loans |
| **Phase 3** | Performance, Training, advanced tax, ESS portal depth |
| **Phase 4** | Analytics packs, multi-country payroll, biometric adapters |

---

## 16. Traceability

| This BRD | Detailed Spec |
|----------|---------------|
| HRMS modules §2.1 | FRD-09 HR Domain |
| Payroll modules §2.2 | FRD-10 Payroll Domain |
| Employee master | FRD-03 Master Data |
| Finance posting | FRD-04 Finance |
| Data model | ERD_11_HR · ERD_12_Payroll |
| Architecture constraints | ERP Architecture Lock v1.1 |

---

## 17. Document Control

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-07-23 | Product / Architecture | Initial HRMS + Payroll BRD with arrow flows |

**Approval required from:** CHRO / HR Head · Payroll Head · Finance Controller · IT Architecture
