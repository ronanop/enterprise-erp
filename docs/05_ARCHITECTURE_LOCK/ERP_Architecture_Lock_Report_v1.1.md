# ERP Architecture Lock Report v1.1

**Document Type:** Final Architecture Approval & Sprint 0 Gate  
**Prepared By:** CTO · Principal Enterprise Architect · ERP Product Architect · Software Governance Architect  
**Date:** 2026-07-06  
**Classification:** Internal - Confidential  
**Scope:** iConnect Plus  

---

## 1. Architecture Approval Summary

This report certifies that the enterprise documentation stack has reached **Architecture Baseline v1.1** and is approved as the **single source of truth** for Sprint 0 and all subsequent development.

| Document | Version | Status | Governance Role |
|----------|---------|--------|-----------------|
| **BRD** - Business Requirements Document | v1.0 | Architecture Baseline Approved | Business intent, scope, domain architecture, stakeholder requirements |
| **FRD** - Functional Requirements (22 domains) | v1.0 | Architecture Approved (All 22 Domains Locked) | Functional behavior, workflows, acceptance criteria |
| **SDD** - System Design Document | **v1.1** | Architecture Baseline Approved (ADR-002) | Application, technical, data, and infrastructure architecture |
| **DBS** - Enterprise Database Standards | **v1.1** | Architecture Baseline Approved (ADR-002) | Database naming, table standards, ORM, migration governance |

### Key Architectural Decisions Locked

| ADR | Decision | Status |
|-----|----------|--------|
| **ADR-001** | Modular Monolith with Clean Architecture + DDD | **LOCKED** |
| **ADR-002** | Python/FastAPI backend stack (supersedes NestJS/Prisma era) | **LOCKED** |

### Documentation Readiness

| Layer | Completeness |
|-------|--------------|
| Business Architecture (BRD) | Complete |
| Functional Architecture (FRD - 22 domains + Master FRD) | Complete |
| System Architecture (SDD v1.1 - 4 volumes) | Complete |
| Database Governance (DBS v1.1) | Complete |
| Estimated documentation readiness | **~92-95%** |

Remaining work is **implementation-oriented** (ERD, physical schema, Alembic migrations, OpenAPI specs, application scaffold) - not planning-oriented.

### Hierarchy of Compliance

All implementation must comply in this order:

```text
BRD → FRD → SDD v1.1 → DBS v1.1 → ERD → Physical Schema → SQLAlchemy Models → Alembic Migrations → API Specifications → Code
```

No deviation is permitted without formal Enterprise Architecture Review Board (EARB) approval and an updated ADR.

---

## 2. Final Approved Technology Stack

### Frontend

| Technology | Role | Status |
|------------|------|--------|
| **Next.js 16+** | Web application framework | Approved |
| **React** | UI library | Approved |
| **TypeScript** | Type-safe frontend language | Approved |
| **Tailwind CSS** | Utility-first styling | Approved |
| **ShadCN UI** | Component library | Approved |
| **Zod** | Client-side validation | Approved (SDD v1.1) |

### Backend

| Technology | Role | Status |
|------------|------|--------|
| **Python 3.13+** | Runtime (PY-01) | Approved |
| **FastAPI** | HTTP API framework | Approved |
| **SQLAlchemy 2.0** | ORM (infrastructure layer only) | Approved |
| **Alembic** | Schema migration tool | Approved |
| **Pydantic v2** | Request/response validation (PY-02) | Approved |
| **Celery** | Async task processing | Approved |
| **Celery Beat** | Scheduled jobs (replaces NestJS Scheduler) | Approved |
| **RabbitMQ** | Message broker | Approved |
| **Redis** | Cache, session store, Celery backend | Approved |
| **Uvicorn** | ASGI server | Approved |
| **Gunicorn** | Production process manager (PY-05) | Approved |

### Database

| Technology | Role | Status |
|------------|------|--------|
| **PostgreSQL** | Primary transactional datastore | Approved |

### Search

| Technology | Role | Status |
|------------|------|--------|
| **OpenSearch** | Full-text search, analytics indexing | Approved |

### Storage

| Technology | Role | Status |
|------------|------|--------|
| **MinIO / AWS S3** | Object storage (documents, attachments, exports) | Approved |

### Infrastructure

| Technology | Role | Status |
|------------|------|--------|
| **Docker** | Containerization | Approved |
| **Kubernetes** | Orchestration (future production target) | Kubernetes Ready |
| **Terraform** | Infrastructure-as-Code | Terraform Ready |

### Explicitly Superseded (ADR-002)

The following are **no longer approved** for this platform:

- NestJS
- TypeScript (backend)
- Prisma ORM
- BullMQ
- NestJS Scheduler

---

## 3. Approved Architecture Pattern

The following patterns are **mandatory** and locked under ADR-001 and ADR-002:

### Clean Architecture

```text
Router Layer (FastAPI)
        ↓
Application Layer (Python Service Layer)
        ↓
Domain Layer (Entities, Business Rules)
        ↓
Infrastructure Layer (SQLAlchemy, Redis, Celery, External Adapters)
```

**Rules:**
- Domain layer must not import SQLAlchemy models (PY-03)
- Pydantic schemas are separate from ORM models
- Infrastructure concerns stay in the infrastructure layer

### Domain Driven Design (DDD)

- Bounded contexts per ERP domain module
- Ubiquitous language aligned with FRD domain terminology
- Aggregates, entities, and domain services in `domain/` package
- Context maps govern cross-domain dependencies (consume via APIs/services, not direct DB)

### Modular Monolith

- Single deployable application unit
- Domain modules under `apps/api/src/modules/`
- Shared platform services: Workflow Engine, Notification Engine, Audit Engine, Integration Hub
- Future extraction to microservices is possible but **not in current scope**

```text
                    ┌─────────────────────────┐
                    │   Modular Monolith      │
                    │   (Single Deployable)   │
                    ├─────────────────────────┤
                    │  Foundation             │
                    │  Organization           │
                    │  Master Data            │
                    │  Business Modules (×19) │
                    │  Platform Services      │
                    └─────────────────────────┘
                              │
                    PostgreSQL (single cluster)
```

---

## 4. Development Rules

### Mandatory Request Flow

```text
Router (FastAPI APIRouter)
        ↓
Service (Application / Business Logic)
        ↓
Repository (SQLAlchemy Data Access)
        ↓
Database (PostgreSQL)
```

### Per-Module Structure (SDD v1.1 §7)

```text
modules/<domain>/
├── router.py          # FastAPI APIRouter - thin handlers only
├── schemas.py         # Pydantic v2 request/response models
├── service.py         # Application / service layer
├── domain/            # Entities, business rules
├── repository.py      # SQLAlchemy data access
├── models.py          # SQLAlchemy ORM models (infrastructure)
├── tasks.py           # Celery tasks (domain-specific)
└── dependencies.py    # Module-scoped FastAPI dependencies
```

### Development Guardrails (DG-01 through DG-06)

| Rule | Requirement |
|------|-------------|
| **DG-01** | No direct DB access from UI |
| **DG-02** | No business logic in routers - handlers delegate to service layer |
| **DG-03** | All approvals through Workflow Engine |
| **DG-04** | All notifications through Notification Engine |
| **DG-05** | All integrations through Integration Hub |
| **DG-06** | All auditing through Audit Engine |

### Backend Development Rules (PY-01 through PY-07)

| Rule | Requirement |
|------|-------------|
| **PY-01** | Python 3.13+ minimum runtime |
| **PY-02** | All API input/output validated with Pydantic v2 |
| **PY-03** | SQLAlchemy models in infrastructure layer only |
| **PY-04** | All schema changes via Alembic migrations |
| **PY-05** | Production API via Gunicorn managing Uvicorn workers |
| **PY-06** | Celery tasks idempotent where retries enabled |
| **PY-07** | Tenant context enforced via FastAPI dependencies and repository filters |

### Architecture Constraints (C-01 through C-06)

| Constraint | Rule |
|------------|------|
| **C-01** | Single source of truth for master data |
| **C-02** | No direct module-to-module database access |
| **C-03** | All integrations through Integration Hub |
| **C-04** | All business approvals through Workflow Engine |
| **C-05** | All notifications through Notification Engine |
| **C-06** | All audits through Central Audit Service |

---

## 5. Module Development Order

Development must follow the **approved dependency chain**. No business module may be started until its upstream dependencies are implemented and verified.

### Phase 1 - Platform Foundation (Sprint 0 → Sprint N)

| Order | Module | FRD | Dependency |
|-------|--------|-----|------------|
| 1 | **Foundation** | FRD-01 | None - platform backbone |
| 2 | **Organization** | FRD-02 | Foundation |
| 3 | **Master Data** | FRD-03 | Foundation, Organization |

### Phase 2 - Foundation Sub-Services (within Foundation Domain)

These are delivered as part of Foundation and must be operational before business modules:

| Service | Purpose |
|---------|---------|
| **Authentication** | Login, JWT, session management |
| **RBAC** | Roles, permissions, resource access |
| **Workflow** | Approval engine (C-04) |
| **Notification** | Multi-channel notifications (C-05) |
| **Audit** | Central audit logging (C-06) |

### Phase 3 - Business Modules (post-foundation gate)

Per FRD Enterprise Dependency Chain:

| Tier | Modules | FRD |
|------|---------|-----|
| **Core Financial** | Finance & Accounting | FRD-04 |
| **Commercial** | CRM → Sales | FRD-05 → FRD-06 |
| **Supply Chain** | Procurement → Inventory → Manufacturing → Quality → SCM | FRD-07 → FRD-08 → FRD-13 → FRD-14 → FRD-15 |
| **People** | HR → Payroll | FRD-09 → FRD-10 |
| **Operations** | Projects, Assets, Service Management, Helpdesk | FRD-11, FRD-12, FRD-16, FRD-17 |
| **Platform** | Integration Hub, E-Commerce | FRD-21, FRD-22 |
| **Cross-Cutting** | BI & Analytics, DMS, GRC | FRD-18, FRD-19, FRD-20 |

```text
Foundation (FRD-01)
        ↓
Organization (FRD-02)
        ↓
Master Data (FRD-03)
        ↓
┌───────────┬───────────┬────────────┬──────────┬──────────────┐
Finance(04) CRM(05)     Procurement(07) HR(09)   Integration(21)
    ↓         ↓              ↓           ↓            ↓
Sales(06)   Sales(06)    Inventory(08) Payroll(10) E-Commerce(22)
                               ↓
                         Manufacturing(13) → Quality(14) → SCM(15)
```

**Finance (FRD-04)** is the central financial sink - all revenue, cost, and asset modules post through Finance.

---

## 6. Database Rules

All database design and implementation must comply with **DBS v1.1**. The following rules are **locked**:

### Primary Keys

| Rule | Standard |
|------|----------|
| **UUID PK** | Every table uses UUID primary key |
| **UUID v7** | Recommended (time-ordered) |
| **UUID v4** | Acceptable fallback |
| **Generation** | Application layer; immutable after creation |

### Multi-Tenancy

| Rule | Standard |
|------|----------|
| **Tenant hierarchy** | Tenant → Company → Branch → Department |
| **Mandatory columns** | `tenant_id`, `company_id`, `branch_id` on all transactional tables |
| **Cross-tenant joins** | Strictly prohibited |
| **Tenant filtering** | Mandatory in every repository and service query (PY-07) |

### Audit Columns

Mandatory on all master and transaction tables:

```text
created_at    TIMESTAMPTZ   - immutable
created_by    UUID          - immutable
updated_at    TIMESTAMPTZ
updated_by    UUID
version       INTEGER       - optimistic locking
```

### Soft Delete

| Rule | Standard |
|------|----------|
| **Physical DELETE** | Prohibited on business tables |
| **Columns** | `is_deleted`, `deleted_at`, `deleted_by` |
| **Query default** | Exclude `is_deleted = true` records |
| **Restore** | Administrator only |
| **Permanent delete** | Requires documented EARB approval |

### Versioning

- `version` column increments on every successful update
- Optimistic concurrency control enforced at service layer
- History tables (SCD Type 2) for master data where required

### Indexes

| Requirement | Standard |
|-------------|----------|
| PK index | Every table |
| Tenant index | `tenant_id` on all transactional tables |
| Company index | `company_id` |
| FK indexes | Every foreign key must be indexed |
| Composite indexes | Designed by query selectivity |
| `SELECT *` | Prohibited |

### Migrations - Alembic Only

| Rule | Standard |
|------|----------|
| **Tool** | Alembic exclusively (PY-04, DBS §78) |
| **Manual schema changes** | Prohibited in production |
| **Lifecycle** | Development → Alembic Migration Generated → Code Review → QA → UAT → Production |
| **Every migration requires** | Architecture review, ERD update, rollback strategy, staging validation |
| **ORM mapping** | SQLAlchemy Declarative Models with `__tablename__` and `mapped_column` |

### Table Classification Prefixes (Locked)

```text
master_   trx_   ref_   audit_   hist_   wf_   cfg_   int_   ana_   ntf_   sch_   sec_
```

### SQLAlchemy ORM Rules

- Declarative Model class names: **PascalCase**
- Database tables and columns: **snake_case**
- Models reside in infrastructure layer only
- API schemas use Pydantic v2 - never expose ORM models directly

---

## 7. Security Rules

### Authentication

| Control | Standard |
|---------|----------|
| **JWT Access Token** | Short-lived API authentication |
| **JWT Refresh Token** | Token renewal |
| **Session Store** | Redis |
| **MFA** | MFA Ready - OTP, TOTP support planned |
| **SSO / OAuth** | Supported authentication methods |

### Authorization

| Control | Standard |
|---------|----------|
| **RBAC** | Permission-driven security |
| **Hierarchy** | User → Role → Permission → Resource |
| **UI rendering** | RBAC-controlled component visibility |
| **API enforcement** | Permission checks at router/service layer |

### Audit Logging

| Control | Standard |
|---------|----------|
| **Central Audit Service** | All auditable operations (C-06, DG-06) |
| **Retention** | Minimum 10 years |
| **Audit tables** | Append-only - no updates or deletes |
| **Audited operations** | Create, Update, Soft Delete, Approve, Reject, Export, Import, Login, Logout, Role Change, Permission Change |

### Encryption

| Layer | Standard |
|-------|----------|
| **In transit** | TLS 1.3 |
| **At rest** | AES-256 |
| **Mandatory encrypted fields** | Password hashes, bank accounts, tax IDs, API secrets, OAuth credentials, payment tokens, PII |
| **Key management** | Centralized with rotation policy |
| **Non-production data** | Production data never copied without masking |

### Data Classification

Every table assigned: **Public**, **Internal**, **Confidential**, or **Restricted**.

---

## 8. Forbidden Architecture Changes

The following are **explicitly blocked** without EARB approval and a new ADR:

### Technology Substitutions (Blocked)

| Forbidden | Approved Alternative |
|-----------|---------------------|
| **NestJS** | FastAPI |
| **Prisma ORM** | SQLAlchemy 2.0 + Alembic |
| **BullMQ** | Celery + RabbitMQ |
| **NestJS Scheduler** | Celery Beat |
| **MongoDB as primary DB** | PostgreSQL |
| **Unapproved backend languages** | Python 3.13+ only |

### Development Anti-Patterns (Blocked)

| Forbidden Practice | Correct Pattern |
|--------------------|-----------------|
| **Direct SQL in routers** | Router → Service → Repository → SQLAlchemy |
| **Business logic inside API handlers** | Delegate to service layer (DG-02) |
| **Cross-module database access** | Module APIs or Integration Hub (C-02) |
| **Bypassing Workflow Engine for approvals** | Workflow Engine (C-04, DG-03) |
| **Bypassing Notification Engine** | Notification Engine (C-05, DG-04) |
| **Bypassing Audit Engine** | Central Audit Service (C-06, DG-06) |
| **SQLAlchemy models in domain layer** | Infrastructure layer only (PY-03) |
| **Manual production schema changes** | Alembic migrations only (PY-04) |
| **Direct DB access from UI** | REST API only (DG-01) |
| **Hardcoded UI labels / business rules** | Configurable via settings/i18n |
| **Physical DELETE on business tables** | Soft delete per DBS |
| **Cross-tenant data access** | Tenant-scoped queries mandatory |

### Change Control

Any proposed architecture change must:

1. Be submitted to the Enterprise Architecture Team
2. Be reviewed and approved by the Steering Committee
3. Be documented in an updated SDD version before implementation
4. Emergency changes require post-implementation documentation within 5 business days

---

## 9. Sprint 0 Entry Checklist

| # | Gate Item | Status | Evidence |
|---|-----------|--------|----------|
| 1 | **BRD Approved** | ✅ PASS | `docs/01_BRD/ERP_BRD_v1.0.md` - business scope, domain architecture, module definitions |
| 2 | **FRD Approved** | ✅ PASS | 22 domain FRDs + `Master-FRD.md` - all domains architecture-approved and locked |
| 3 | **SDD Approved** | ✅ PASS | `docs/03_SDD/ERP_SDD_v1.0.md` v1.1 - ADR-001, ADR-002, 4 volumes complete |
| 4 | **DBS Approved** | ✅ PASS | `docs/04_DBS/ERP_DBS_v1.0.md` v1.1 - SQLAlchemy 2.0 / Alembic aligned to ADR-002 |
| 5 | **Tech Stack Approved** | ✅ PASS | ADR-002 locked: Python/FastAPI/SQLAlchemy/Alembic/Celery + Next.js 16+ frontend |
| 6 | **Repository Ready** | ✅ PASS | Documentation monorepo established; SDD-defined `apps/api/src/` structure approved for Sprint 0 scaffold |

### Sprint 0 Deliverables (First Implementation Sprint)

| Deliverable | Source |
|-------------|--------|
| Monorepo scaffold (`apps/api`, `apps/web`) | SDD v1.1 §7 |
| PostgreSQL + Alembic bootstrap | DBS v1.1 §78, §79 |
| FastAPI core (`main.py`, `core/`) | SDD v1.1 §7 |
| Foundation module skeleton | FRD-01 |
| CI/CD pipeline baseline | SDD Volume 4 |
| Docker Compose (dev environment) | SDD Volume 4 |

### Pre-Development Artifacts (Parallel / Sprint 0)

| Artifact | Owner | Status |
|----------|-------|--------|
| Enterprise ERD | Data Architecture | Pending - next phase per DBS |
| Physical Database Schema | Data Architecture | Pending |
| OpenAPI Specifications | Solution Architecture | Pending |
| Alembic initial migration | Development | Pending (Sprint 0) |

---

## 10. Final Architecture Decision

Having reviewed BRD v1.0, FRD v1.0 (22 domains), SDD v1.1 (ADR-001 + ADR-002), and DBS v1.1, the Enterprise Architecture Review Board certifies:

- **Architecture pattern** (Modular Monolith + Clean Architecture + DDD) is locked
- **Technology stack** (Python/FastAPI/SQLAlchemy/Alembic/Celery + Next.js 16+) is locked
- **Database governance** (PostgreSQL, UUID, tenant isolation, audit, soft delete, Alembic-only) is locked
- **Security baseline** (JWT, RBAC, MFA-ready, audit logging, encryption) is locked
- **Development guardrails** (DG-01-06, PY-01-07, C-01-06) are mandatory
- **Module development order** (Foundation → Organization → Master Data → Platform Services → Business Modules) is locked
- **Forbidden changes** are documented and enforceable

All development teams, contractors, and vendors must comply with this baseline. Deviations require formal EARB approval.

---

**ERP Architecture Baseline v1.1 LOCKED. Approved to start Sprint 0 Development.**
