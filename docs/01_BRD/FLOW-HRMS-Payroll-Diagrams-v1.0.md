# HRMS & Payroll — Complete Process Flows & Diagrams

| Attribute | Value |
|-----------|-------|
| **Document ID** | FLOW-HRMS-PAY-v1.0 |
| **Product** | Enterprise ERP Platform |
| **Parent BRD** | [BRD-HRMS-Payroll-v1.0.md](./BRD-HRMS-Payroll-v1.0.md) |
| **Related FRD** | [FRD-09 HR](../02_FRD/FRD-09-HR-Domain.md) · [FRD-10 Payroll](../02_FRD/FRD-10-Payroll-Domain.md) |
| **Version** | 1.0 |
| **Date** | 23 July 2026 |

> This file contains **all arrow flow diagrams** for HRMS and Payroll.  
> Open in any Markdown viewer that supports **Mermaid** (GitHub, VS Code, Cursor preview).

---

## Table of Contents

1. [Master End-to-End Lifecycle](#1-master-end-to-end-lifecycle)
2. [System Integration Map](#2-system-integration-map)
3. [Recruitment → Hire](#3-recruitment--hire)
4. [Employee Management (Workforce)](#4-employee-management-workforce)
5. [Shift & Roster](#5-shift--roster)
6. [Attendance Management](#6-attendance-management)
7. [Leave Management](#7-leave-management)
8. [Leave Approval Workflow](#8-leave-approval-workflow)
9. [Attendance Correction Workflow](#9-attendance-correction-workflow)
10. [Performance & Training](#10-performance--training)
11. [Separation / Exit](#11-separation--exit)
12. [Payroll Processing](#12-payroll-processing)
13. [Payroll Approval Workflow](#13-payroll-approval-workflow)
14. [Payroll → Finance Posting](#14-payroll--finance-posting)
15. [People → Time → Pay → Finance (Swimlane)](#15-people--time--pay--finance-swimlane)
16. [ASCII Quick Reference (All Flows)](#16-ascii-quick-reference-all-flows)

---

## 1. Master End-to-End Lifecycle

```mermaid
flowchart TD
  A[Job Requisition] --> B[Candidate]
  B --> C[Interview]
  C --> D[Offer]
  D --> E[Onboarding]
  E --> F[Employee Master<br/>Workforce]
  F --> G[Shift / Roster]
  F --> H[Attendance]
  F --> I[Leave]
  F --> J[Performance / Training]
  G --> K[Payroll Inputs]
  H --> K
  I --> K
  K --> L[Payroll Run]
  J -.->|increment input P1| L
  L --> M[Payslip]
  L --> N[Bank Transfer]
  L --> O[Finance GL Posting]
  F --> P[Separation]
  P --> Q[Full and Final]
  Q --> L
```

### Linear arrow view

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
         Payslip + Bank + Finance GL
                    ↓
      Separation / Full & Final (on exit)
```

---

## 2. System Integration Map

```mermaid
flowchart LR
  ORG[Organization<br/>Company / Branch] --> MD[Master Data<br/>Employee]
  MD --> HR[HRMS]
  HR --> PY[Payroll]
  PY --> FIN[Finance GL]
  PL[Platform Engines<br/>Workflow · Notification<br/>Audit · RBAC] --> HR
  PL --> PY

  HR --- ATT[Attendance]
  HR --- LVE[Leave]
  HR --- SFT[Shifts]
  HR --- SEP[Separation]
  ATT --> PY
  LVE --> PY
  SFT --> PY
  SEP --> PY
```

```text
Organization
      ↓
Master Employee
      ↓
   HRMS ──────────────► Payroll ──────────────► Finance
     │                     ▲
     ├─ Attendance ────────┤
     ├─ Leave ─────────────┤
     ├─ Shifts ────────────┤
     └─ Separation ────────┘

Platform: Workflow · Notification · Audit · RBAC
```

**Boundary rule:** Payroll reads HR facts; Payroll does not write attendance/leave. HR does not post GL journals.

---

## 3. Recruitment → Hire

```mermaid
flowchart TD
  A[Department raises<br/>Job Requisition] --> B[HR / Hiring Manager<br/>approves]
  B --> C[Requisition OPEN]
  C --> D[Candidates sourced<br/>and screened]
  D --> E[Interview rounds<br/>schedule → feedback]
  E --> F[Offer drafted]
  F --> G[Offer approved]
  G --> H[Offer sent]
  H --> I{Candidate<br/>accepts?}
  I -->|Yes| J[Onboarding checklist]
  I -->|No| K[Offer closed / reopen search]
  J --> L[Employee created<br/>EMP-######]
```

```text
Department raises Job Requisition
      ↓
HR / Hiring Manager approves
      ↓
Requisition OPEN
      ↓
Candidates sourced & screened
      ↓
Interview rounds
      ↓
Offer drafted → approved → sent
      ↓
Candidate accepts?
  ├─ Yes → Onboarding → Employee (EMP-######)
  └─ No  → Close / reopen search
```

---

## 4. Employee Management (Workforce)

```mermaid
flowchart TD
  A[Start: Add Employee] --> B1[Step 1: Personal]
  B1 --> B2[Step 2: Employment]
  B2 --> B3[Step 3: Government IDs]
  B3 --> B4[Step 4: Bank]
  B4 --> B5[Step 5: Salary optional]
  B5 --> B6[Step 6: Documents]
  B6 --> B7[Step 7: Review]
  B7 --> C[Create Master Employee<br/>+ HR Profile + Employment]
  C --> D[Employee Profile 360]
  D --> E{Lifecycle status}
  E --> F[Active]
  E --> G[Probation]
  E --> H[Notice]
  E --> I[Inactive]
  E --> J[Archived soft delete]
```

```text
Add Employee Wizard
  1 Personal → 2 Employment → 3 Gov IDs → 4 Bank
  → 5 Salary (opt) → 6 Documents → 7 Review
      ↓
Master + Profile + Employment
      ↓
Profile 360°
      ↓
Status: Active | Probation | Notice | Inactive | Archived
```

---

## 5. Shift & Roster

```mermaid
flowchart TD
  A[Create Shift Master<br/>SHIFT-001…] --> B[Assign Shift]
  B --> C{Assignment type}
  C --> D[Permanent]
  C --> E[Temporary]
  C --> F[Rotation]
  F --> G[Rotation cycle<br/>Morning → Evening → Night → Off]
  D --> H[Roster Calendar]
  E --> H
  G --> H
  H --> I[Drag and drop assign / swap]
  I --> J[Shift Swap Request]
  J --> K[Manager]
  K --> L[HR]
  L --> M[Approved]
  H --> N[Feeds Attendance<br/>and OT rules]
```

```text
Create Shift Master (SHIFT-001…)
      ↓
Assign Shift (Permanent / Temporary / Rotation)
      ↓
Optional Rotation: Morning → Evening → Night → Off
      ↓
Roster Calendar (Weekly / Monthly)
      ↓
Swap: Employee → Manager → HR → Approved
      ↓
Roster → Attendance & Overtime rules
```

---

## 6. Attendance Management

```mermaid
flowchart TD
  A[Punch / Mark Attendance] --> B{Source}
  B --> B1[Manual]
  B --> B2[Biometric]
  B --> B3[Mobile / Web]
  B --> B4[QR / Face]
  B1 --> C[Validate vs Shift<br/>Grace · Holiday · Weekly Off]
  B2 --> C
  B3 --> C
  B4 --> C
  C --> D[Status<br/>Present / Absent / Late / Half Day<br/>WFH / Leave / Missed Punch]
  D --> E[Auto OT<br/>Normal → OT → Double OT]
  E --> F{Correction needed?}
  F -->|Yes| G[Correction Request]
  G --> H[Manager → HR → Approved]
  H --> I[Period Lock]
  F -->|No| I
  I --> J[Payroll Attendance Facts]
```

```text
Punch / Mark (Manual | Biometric | Mobile | Web | QR | Face)
      ↓
Validate vs Shift + Grace + Holiday + Weekly Off
      ↓
Status + Auto OT
      ↓
Correction? → Manager → HR → Approved
      ↓
Lock period → Payroll attendance facts
```

---

## 7. Leave Management

```mermaid
flowchart TD
  A[Employee applies leave] --> B[Auto validation]
  B --> B1[Leave balance]
  B --> B2[Holiday calendar]
  B --> B3[Weekly offs]
  B --> B4[Overlapping leave]
  B --> B5[Probation / Gender / Policy]
  B1 --> C{Validation OK?}
  B2 --> C
  B3 --> C
  B4 --> C
  B5 --> C
  C -->|No| D[Show errors — block submit]
  C -->|Yes| E[Submit for approval]
  E --> F[Approval workflow]
  F --> G[Approved]
  G --> H[Update balances<br/>Used / Pending / Available]
  H --> I[Optional: Comp-off<br/>Carry Forward · Encashment]
  G --> J[Exclude from Payroll LOP]
```

```text
Apply Leave
      ↓
Auto validation (balance, holidays, offs, overlaps, policy)
      ↓
Submit → Approval workflow
      ↓
Approved → Balance update
      ↓
Optional CF / Comp-off / Encashment
      ↓
Feeds Payroll (no LOP for approved leave)
```

---

## 8. Leave Approval Workflow

```mermaid
flowchart TD
  A[Employee] --> B[Reporting Manager]
  B -->|Approve| C[HR]
  B -->|Reject| R[Rejected]
  B -->|Send back / Info| A
  C -->|Approve| D{Director<br/>optional?}
  C -->|Reject| R
  D -->|Yes path| E[Director]
  D -->|Skip| F[Approved]
  E -->|Approve| F
  E -->|Reject| R
  F --> G[Balance updated]
  F --> H[Notify Employee]
```

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

---

## 9. Attendance Correction Workflow

```mermaid
flowchart TD
  A[Employee requests<br/>correction] --> B[Manager review]
  B -->|Approve| C[HR review]
  B -->|Reject| R[Rejected]
  C -->|Approve| D[Attendance adjusted]
  C -->|Reject| R
  D --> E[Audit logged]
  D --> F[Updated facts for Payroll]
```

```text
Employee
   ↓
Manager
   ↓
HR
   ↓
Approved → Attendance adjusted → Audit logged
```

---

## 10. Performance & Training

```mermaid
flowchart TD
  subgraph Performance
    P1[Goals / KPIs set] --> P2[Review cycle opened]
    P2 --> P3[Self appraisal]
    P3 --> P4[Manager appraisal]
    P4 --> P5[Rating finalized]
    P5 -.->|optional| P6[Increment input<br/>to Payroll]
  end

  subgraph Training
    T1[Training program created] --> T2[Employees enrolled]
    T2 --> T3[Training attendance]
    T3 --> T4[Completion certificate]
  end
```

```text
Goals → Review cycle → Self + Manager appraisal → Rating
                                              └─► Increment (opt) → Payroll

Training program → Enroll → Attendance → Certificate
```

---

## 11. Separation / Exit

```mermaid
flowchart TD
  A[Resignation / Termination<br/>/ Retirement] --> B[Manager approval]
  B --> C[HR approval]
  C --> D[Exit checklist]
  D --> D1[Asset return]
  D --> D2[Knowledge transfer]
  D --> D3[Access revoke]
  D1 --> E[Last working day]
  D2 --> E
  D3 --> E
  E --> F[Notice settlement]
  F --> G[Full and Final<br/>Payroll run]
  G --> H[Employee Archived]
```

```text
Initiator (Employee / HR)
   ↓
Manager
   ↓
HR
   ↓
Clearance (assets, KT, access)
   ↓
LWD + notice settlement
   ↓
Full & Final payroll
   ↓
Employee Archived
```

---

## 12. Payroll Processing

```mermaid
flowchart TD
  A[Open payroll period] --> B[Pull HR inputs]
  B --> B1[Attendance days / OT]
  B --> B2[Leave / LOP]
  B --> B3[Salary structure]
  B --> B4[Loans EMI / advances]
  B --> B5[One-time allowances<br/>/ deductions]
  B1 --> C[Calculate]
  B2 --> C
  B3 --> C
  B4 --> C
  B5 --> C
  C --> D[Gross → Statutory → Net]
  D --> E[Payroll Officer review]
  E --> F[Approval workflow]
  F --> G[Generate payslips]
  F --> H[Bank payment file]
  F --> I[Post journal to Finance]
  G --> J[Period locked]
  H --> J
  I --> J
```

```text
Open period
      ↓
Pull HR inputs (attendance, leave, structure, loans…)
      ↓
Calculate gross → statutory → net
      ↓
Review → Approve
      ↓
Payslip + Bank file + Finance GL
      ↓
Period locked
```

---

## 13. Payroll Approval Workflow

```mermaid
flowchart TD
  A[Payroll Officer<br/>Draft run] --> B[Payroll Manager<br/>Review]
  B -->|Send back| A
  B -->|Approve| C[Finance Controller<br/>Approve posting]
  C -->|Reject / send back| B
  C -->|Approve| D[Payslips published]
  C -->|Approve| E[Bank file released]
  C -->|Approve| F[GL journal posted]
```

```text
Payroll Officer (Draft)
   ↓
Payroll Manager (Review)
   ↓
Finance Controller (Approve posting)
   ↓
Payslip + Bank + GL posted
```

---

## 14. Payroll → Finance Posting

```mermaid
flowchart TD
  A[Payroll Run APPROVED] --> B[Generate journal lines]
  B --> C[Dr Salary Expense<br/>Employer PF etc.]
  B --> D[Cr Payable / PF Payable<br/>TDS Payable / Bank]
  C --> E[Finance posts journal]
  D --> E
  E --> F[Tenant + company isolation]
  E --> G[Audit trail]
  E --> H[Statutory remittance<br/>tracking]
```

```text
Payroll Run APPROVED
      ↓
Generate journal
  Dr  Salary Expense / Employer contributions
  Cr  Payable / PF / TDS / Bank
      ↓
Finance posts journal
      ↓
Statutory remittance tracked
```

---

## 15. People → Time → Pay → Finance (Swimlane)

```mermaid
flowchart TB
  subgraph Recruit["RECRUIT & HIRE"]
    R1[Requisition] --> R2[Candidate] --> R3[Offer] --> R4[Onboard]
  end

  subgraph Workforce["WORKFORCE"]
    W1[Employee Master]
    W2[Documents / Bank / Gov IDs]
  end

  subgraph Time["TIME & LEAVE"]
    T1[Shift / Roster]
    T2[Attendance]
    T3[Leave]
  end

  subgraph Pay["PAYROLL"]
    P1[Structure]
    P2[Run]
    P3[Payslip / Bank]
  end

  subgraph Fin["FINANCE"]
    F1[GL Posting]
  end

  subgraph Exit["EXIT"]
    X1[Separation] --> X2[Full and Final]
  end

  R4 --> W1
  W1 --> W2
  W1 --> T1
  W1 --> T2
  W1 --> T3
  T1 --> P2
  T2 --> P2
  T3 --> P2
  P1 --> P2
  P2 --> P3
  P2 --> F1
  W1 --> X1
  X2 --> P2
```

---

## 16. ASCII Quick Reference (All Flows)

### A. Master lifecycle

```text
Req → Candidate → Interview → Offer → Onboard → Employee
        → Shift | Attendance | Leave | Performance
                        ↓
                   Payroll → Payslip → Bank → Finance
                        ↑
                   Separation / F&F
```

### B. Leave approval

```text
Employee → Manager → HR → [Director] → Approved
                ↘ Reject
```

### C. Attendance correction

```text
Employee → Manager → HR → Adjusted + Audit
```

### D. Shift swap

```text
Employee → Manager → HR → Approved → Roster updated
```

### E. Separation

```text
Initiator → Manager → HR → Clearance → F&F Payroll → Archived
```

### F. Payroll

```text
Open → Inputs → Calculate → Review → Approve
         → Payslip | Bank | GL → Lock
```

### G. Integration

```text
Org → Master Employee → HRMS → Payroll → Finance
                          ↑
              Workflow · Audit · RBAC · Notify
```

---

## Legend

| Symbol / Style | Meaning |
|----------------|---------|
| Solid arrow `→` | Mandatory next step |
| Dashed arrow `-·->` | Optional / P1 path |
| Diamond | Decision / branch |
| Soft delete / Archive | No physical delete of business records |

---

## Document Control

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-07-23 | Separate flows file with Mermaid + ASCII for all HRMS & Payroll processes |

**Parent:** [BRD-HRMS-Payroll-v1.0.md](./BRD-HRMS-Payroll-v1.0.md)
