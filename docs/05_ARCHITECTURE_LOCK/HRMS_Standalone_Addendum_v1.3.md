# HRMS Standalone Addendum v1.3

**Document type:** Product-scope addendum to Architecture Lock Report v1.1  
**Date:** 2026-11-19  
**Status:** Informative (does not unlock Tier D or change ADR-001 / ADR-002)  
**Parent:** `ERP_Architecture_Lock_Report_v1.1.md`

This addendum records that **this repository is an HRMS-only product**. It does **not** change the locked stack (Next.js, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Router → Service → Repository).

## 1. Product scope

| Surface | Role |
|---------|------|
| `apps/web` | HRMS admin UI (`/login`, `/hr/*`, public careers / onboarding) |
| `apps/api` | FastAPI modular monolith — HRMS modules only |

Employee PWA / mobile clients were removed from this repository. ESS APIs remain under `modules/ess` for HR admin inbox and future clients.

Do **not** reintroduce finance, CRM, procurement, inventory, manufacturing, quality, projects, assets (ERP), service, helpdesk (ERP), documents (ERP DMS), marketing, analytics, ecommerce, voice-agent, GRC, integration, portal, or sales as first-class modules in this repo.

## 2. Kept API modules

| Module | PostgreSQL schema(s) | Purpose |
|--------|----------------------|---------|
| `foundation` | `foundation` | Login, users, RBAC, sessions, notifications, audit, workflows |
| `organization` | `organization` | Company, branch, department (Org Setup) |
| `master_data` | `master` | Employee master (`master_employee`) only |
| `platform` | `platform` / foundation job tables | Notify, outbox, audit facades, Celery idempotency |
| `hr` | `hr` | Core HRMS + ESS-local assets/tickets |
| `payroll` | `payroll` | Salary, runs, payslips (no finance GL posting) |
| `recruitment` | `recruitment` | ATS, careers, pre-hire onboarding |
| `ess` | — (orchestrates `hr` / `payroll`) | Employee self-service API |

## 3. Single login

- One credential: work email **or** employee code + password.
- One endpoint: `POST /api/v1/auth/login`.
- HR web uses HttpOnly cookies; the same login endpoint remains available for future ESS clients (bearer tokens).
- Post-login for HR admins: `/hr`.
- Superadmin Panel (`/hr/superadmin`) grants HR logins, company/entity scope, and sidebar `navKey`s.
- Assignable product module key: `hr`. Nested permission prefixes (`organization`, `payroll`, `recruitment`, `master-data`) unlock via `HRMS_NESTED_MODULE_KEYS` when the user has `hr`.

## 4. Database

- Fresh empty database only. Do **not** upgrade a full-ERP database with the HRMS baseline.
- Alembic history is a single baseline of the kept schemas above.
- Soft delete, UUID PKs, tenant/company/branch isolation, and audit columns remain mandatory (DBS v1.1).

## 5. Explicitly removed

ERP business modules listed in §1, their web routes, Celery beat entries, and Alembic revisions that created their schemas. Payroll may record posting status on payroll tables; it must not call a finance journal adapter.
