"""One-shot: transform archived Master Architecture MD into current iConnect Plus doc."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "_master_arch_original.md"
DST = ROOT / "docs" / "07_MASTER_ARCHITECTURE" / "Enterprise_ERP_Master_Architecture.md"


def main() -> None:
    text = SRC.read_text(encoding="utf-8")

    new_header = """# iConnect Plus — Master Architecture Document

**Document type:** Solution Architecture & Shipping Master  
**Product:** iConnect Plus (Enterprise ERP)  
**Baseline:** Architecture Lock v1.1 · Addendum v1.2 · ADR-001 · ADR-002  
**Updated:** 2026-10-09  
**Classification:** Internal — Confidential  
**Audience:** Engineering, Architecture, DevOps, Product  

This is the **master architecture document** for **iConnect Plus** as implemented and as locked. It consolidates system design, the locked technology stack, platform seams, module features and flows, Mermaid architecture diagrams, and shipping strategies for **Coolify/AWS**, **Compose**, and **on-premise**. Calendar timelines and month-based phase dates are intentionally omitted.

For day-to-day module detail prefer [`docs/00_CURRENT/`](../00_CURRENT/). This document is the consolidated architecture view aligned with Addendum v1.2.

---
"""

    text = re.sub(
        r"^# Enterprise ERP Platform — Master Architecture Document.*?\n---\n\n## Contents",
        new_header + "\n## Contents",
        text,
        count=1,
        flags=re.S,
    )

    old_exec = """## 1. Executive Summary

The Enterprise ERP Platform is a **modular monolith** ERP ecosystem covering foundation platform services and twenty-plus business domains — Finance, CRM, Sales, Procurement, Inventory, Manufacturing, Quality, HR, Payroll, Projects, Assets, Service, Helpdesk, Documents, GRC, Analytics, Integration, Ecommerce, Portal, Marketing, and employee self-service — with roadmap extensions for AI Assistant / Virtual E.A., Licensing, and Backup & DR.

Every module shares:

- One identity and RBAC model  
- One design system (Next.js + Tailwind + ShadCN)  
- One API surface (`/api/v1`)  
- One transactional database (PostgreSQL) with tenant isolation  
- Shared Workflow, Notification, Audit, and Integration engines  

**Central decisions (locked):**

| Decision | Choice |
|----------|--------|
| Architecture | Modular monolith · Clean Architecture · DDD (ADR-001) |
| Backend | Python 3.13+ · FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 · Celery (ADR-002) |
| Frontend | Next.js 16+ · TypeScript · Tailwind · ShadCN · Zod |
| OLTP | PostgreSQL |
| Cache / broker | Redis · RabbitMQ |
| Search / objects | OpenSearch · MinIO or AWS S3 |
| Deploy artifact | Docker images (API, worker, beat, web, employee-app) |
| Cloud primary | AWS (EKS/ECS, RDS, S3, ElastiCache, OpenSearch) |
| On-prem | Same containers · Compose / K3s / customer Kubernetes |

SaaS (cloud or private datacenter) and on-premise share **one codebase and one image pipeline**; configuration and infrastructure topology differ by destination."""

    new_exec = """## 1. Executive Summary

**iConnect Plus** is a **modular monolith** ERP covering foundation platform services and twenty-plus business domains — Finance, CRM, Sales, Procurement, Inventory, Manufacturing, Quality, HR, Payroll, Projects, Assets, Service, Helpdesk, Documents, GRC, Analytics, Integration, Ecommerce, Portal, Marketing, and employee self-service — plus platform AI surfaces (`agent_read`, `voice_agent`, MCP) and roadmap extensions for Virtual E.A., Licensing, and Backup & DR.

Every module shares:

- One identity and RBAC model (permission catalogs + HttpOnly JWT cookies)  
- One design system (Next.js + Tailwind + ShadCN · UI/UX Pro Max)  
- One API surface (`/api/v1`)  
- One transactional database (PostgreSQL) with tenant isolation  
- Shared Workflow, Notification, Audit, and Integration engines  
- Shared **`modules.platform`** seams (ports, outbox, numbering, approvals, encryption, SLOs)  

**Central decisions (locked + current shipping):**

| Decision | Choice |
|----------|--------|
| Architecture | Modular monolith · Clean Architecture · DDD (ADR-001) |
| Backend | Python 3.13+ · FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 · Celery (ADR-002) |
| Frontend | Next.js 16+ · TypeScript · Tailwind · ShadCN · Zod |
| OLTP | PostgreSQL |
| Cache / broker | Redis · RabbitMQ |
| Objects | MinIO (local/on-prem) · AWS S3 (cloud) |
| Search | OpenSearch — **evolution-gated** (not required for OLTP) |
| Auth | Microsoft Entra SSO · JWT in **HttpOnly cookies** |
| Deploy artifact | Docker images (API, worker, beat, web, employee-app) |
| SaaS shipping today | Coolify on EC2 · RDS PostgreSQL · S3 · Compose (`docker-compose.coolify.yml`) |
| Cloud target (gated) | EKS/ECS · ElastiCache · Amazon MQ · OpenSearch when Tier D readiness is met |
| On-prem | Same containers · Compose / K3s / customer Kubernetes |

SaaS and on-premise share **one codebase and one image pipeline**; configuration and infrastructure topology differ by destination."""

    if old_exec not in text:
        raise SystemExit("executive summary block not found")
    text = text.replace(old_exec, new_exec)

    text = text.replace(
        "| Platform | Foundation, Email/Notifications, Organization, Master Data, Integration Hub | Tenant, user, role, company, branch, employee/customer/vendor/product masters |",
        "| Platform | Foundation, Email/Notifications, Organization, Master Data, Integration Hub, **platform** seams | Tenant, user, role, company, branch, employee/customer/vendor/product masters, outbox |",
    )
    text = text.replace(
        "| Insight | Analytics, GRC, AI/EA (roadmap), Licensing (roadmap), Backup/DR (roadmap) | KPI, policy, risk, entitlement, backup job |",
        "| Insight | Analytics, GRC, Agent/Voice/MCP (partial), Licensing (roadmap), Backup/DR (roadmap) | KPI, policy, risk, entitlement, backup job |",
    )

    text = text.replace(
        """```mermaid
flowchart TB
  subgraph clients [Clients]
    WEB[Next.js Admin Web]
    EMP[Employee App ESS]
    EXT[External API Consumers]
    ADD[Office / Workspace Add-ins future]
  end

  subgraph edge [Edge]
    WAF[CDN / WAF]
    LB[Load Balancer / Ingress]
  end

  subgraph app [Application Cluster]
    API[FastAPI Modular Monolith]
    WRK[Celery Workers]
    BEAT[Celery Beat]
  end

  subgraph data [Data Layer]
    PG[(PostgreSQL)]
    RD[(Redis)]
    RMQ[[RabbitMQ]]
    OS[(OpenSearch)]
    OBJ[(MinIO or S3)]
  end

  clients --> WAF --> LB
  LB --> WEB
  LB --> EMP
  LB --> API
  API --> PG
  API --> RD
  API --> OS
  API --> OBJ
  API --> RMQ
  WRK --> RMQ
  WRK --> PG
  WRK --> RD
  WRK --> OBJ
  BEAT --> RMQ
```""",
        """```mermaid
flowchart TB
  subgraph clients [Clients]
    WEB[Next.js Admin Web]
    EMP[Employee App ESS]
    EXT[External API Consumers]
    MCP[Agent / MCP clients]
  end

  subgraph edge [Edge]
    CFY[Coolify TLS / reverse proxy]
    LB[ALB / Ingress target]
  end

  subgraph app [Application Cluster]
    API[FastAPI Modular Monolith]
    PLAT[platform ports outbox]
    WRK[Celery Workers]
    BEAT[Celery Beat]
  end

  subgraph data [Data Layer]
    PG[(PostgreSQL RDS or local)]
    RD[(Redis)]
    RMQ[[RabbitMQ]]
    OBJ[(MinIO or S3)]
  end

  clients --> CFY
  clients --> LB
  CFY --> WEB
  CFY --> EMP
  CFY --> API
  LB --> WEB
  LB --> EMP
  LB --> API
  API --> PLAT
  API --> PG
  API --> RD
  API --> OBJ
  API --> RMQ
  WRK --> RMQ
  WRK --> PG
  WRK --> RD
  WRK --> OBJ
  BEAT --> RMQ
  PLAT --> WRK
```""",
    )

    text = text.replace(
        "| Data | OLTP, cache/sessions, broker, search, object storage |",
        "| Data | OLTP, cache/sessions, broker, object storage (OpenSearch gated) |\n| Platform | Ports/adapters, transactional outbox, numbering, approvals, encryption, SLO |",
    )

    text = text.replace(
        "Aligned with [ERP Architecture Lock Report v1.1](../05_ARCHITECTURE_LOCK/ERP_Architecture_Lock_Report_v1.1.md).",
        "Aligned with [ERP Architecture Lock Report v1.1](../05_ARCHITECTURE_LOCK/ERP_Architecture_Lock_Report_v1.1.md) and [Addendum v1.2](../05_ARCHITECTURE_LOCK/ERP_Architecture_Addendum_v1.2.md).",
    )
    text = text.replace(
        "| Search | OpenSearch | Full-text / analytics indexing |",
        "| Search | OpenSearch (gated) | Full-text / analytics indexing — not required for current OLTP |",
    )
    text = text.replace(
        "| Auth federation | Microsoft Entra ID (OIDC) · JWT sessions | SSO + local auth / MFA |",
        "| Auth federation | Microsoft Entra ID (OIDC) · JWT **HttpOnly cookies** | SSO + local auth / MFA |",
    )
    text = text.replace(
        "| Orchestration | Kubernetes Ready · Terraform Ready | Target production |",
        "| Antivirus | ClamAV | Upload scanning |\n| Field encryption | `EncryptedText` / `FIELD_ENCRYPTION_KEYS` | Tax / KYC / bank / integration secrets |\n| Orchestration today | Docker Compose · Coolify on EC2 | Primary SaaS shipping path |\n| Orchestration target | Kubernetes Ready · Terraform Ready | Tier D / EARB when readiness met |",
    )
    text = text.replace(
        "| Design system | `design-system/enterprise-erp-platform/MASTER.md` | Data-dense · Swiss minimal |",
        "| Design system | `design-system/enterprise-erp-platform/MASTER.md` (+ `iconnect-plus/`) | Data-dense · Swiss minimal · UI/UX Pro Max |",
    )

    text = text.replace(
        """```text
enterprise-erp-platform/
├── apps/api/          # FastAPI modular monolith
├── apps/web/          # Next.js admin
├── apps/employee-app/ # Next.js ESS
├── docs/              # BRD FRD SDD DBS ERD Architecture Lock Master
├── design-system/     # UI tokens and page overrides
├── docker-compose.yml # Infra: Redis RabbitMQ MinIO OpenSearch
└── infrastructure/    # IaC growth area
```""",
        """```text
enterprise-erp/   # iConnect Plus monorepo
├── apps/api/                    # FastAPI modular monolith (+ platform, alembic, workers)
├── apps/web/                    # Next.js admin (iconnectplus.in)
├── apps/employee-app/           # Next.js ESS PWA (ess.iconnectplus.in)
├── apps/employee-app-by-Rishabh/ # Employee mobile (Expo / React Native)
├── docs/                        # Baseline pack + 00_CURRENT living docs
├── design-system/               # UI/UX Pro Max tokens
├── docker-compose.local.yml     # All-in-one local
├── docker-compose.infra.yml     # Redis RabbitMQ MinIO (+ optional OpenSearch)
├── docker-compose.app.yml       # App against external infra
├── docker-compose.coolify.yml   # Coolify / EC2 SaaS profile
└── .env.example
```""",
    )

    text = text.replace(
        "`foundation`, `organization`, `master_data`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `ess`, `payroll`, `recruitment`, `project`, `asset`, `service`, `helpdesk`, `document`, `grc`, `analytics`, `integration`, `ecommerce`, `portal` (+ marketing scaffolding).",
        "`landing`, `platform`, `foundation`, `organization`, `master_data`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `ess`, `payroll`, `recruitment`, `project`, `asset`, `service`, `helpdesk`, `document`, `marketing`, `grc`, `analytics`, `integration`, `ecommerce`, `portal`, `voice_agent`, `agent_read`, `mcp_server`.",
    )

    text = text.replace(
        "  W->>A: REST /api/v1/... + JWT\n  A->>A: Auth RBAC tenant context\n  A->>S: Delegate use case\n  S->>E: Workflow Notification Audit as required\n  S->>R: Persist / query",
        "  W->>A: REST /api/v1/... + HttpOnly JWT cookie\n  A->>A: Auth RBAC tenant context\n  A->>S: Delegate use case\n  S->>E: Workflow / outbox notify audit / platform ports\n  S->>R: Persist / query",
    )

    text = text.replace(
        "| Auth | JWT access + refresh; MFA; Microsoft OAuth supported |",
        "| Auth | JWT in HttpOnly cookies; MFA; Microsoft Entra OAuth |",
    )
    text = text.replace(
        """### 7.2 Security controls (target)

Edge WAF/DDoS · short-lived tokens · input validation · OWASP-aligned engineering · encrypted backups · immutable audit from mutation path · ISO 27001 / SOC 2 posture for SaaS offerings.""",
        """### 7.2 Security controls (current + target)

| Control | Status |
|---------|--------|
| HttpOnly session cookies; shorter privileged TTL | Current |
| RBAC permission catalogs + CI route/UI sync | Current |
| ClamAV upload scanning | Current |
| Field-level encryption (tax / KYC / bank / secrets) | Current |
| SSRF allowlist for integration outbound | Current |
| Immutable audit via foundation + platform facade/outbox | Current |
| Edge WAF/DDoS · ISO 27001 / SOC 2 SaaS posture | Target |
| Security evidence | `docs/security/` |""",
    )

    text = text.replace(
        "| OpenSearch | Search indexes | Index or filter per tenant |",
        "| OpenSearch (gated) | Search indexes when enabled | Index or filter per tenant |",
    )

    old_engines = """## 9. Platform Engines

| Engine | Responsibility | Home |
|--------|----------------|------|
| Identity & RBAC | Login, MFA, OAuth, roles, permissions, module members | Foundation |
| Workflow | Definitions, instances, approvals, escalation | Foundation |
| Notification / Email | Templates, events, deliveries, Graph send, FCM devices | Foundation + Email UI |
| Audit | Immutable mutation/event logs | Foundation |
| Integration Hub | Connectors, webhooks, sync jobs, mappings, DLQ | Integration module |
| Document service | Versioned library consumed cross-module | Document module |
| Settings | System and tenant configuration | Foundation |

```mermaid
flowchart TB
  M[Any Business Module] --> WF[Workflow Engine]
  M --> NTF[Notification Engine]
  M --> AUD[Audit Engine]
  M --> INT[Integration Hub]
  M --> DOC[Document Service]
  WF --> NTF
```"""

    new_engines = """## 9. Platform Engines

| Engine | Responsibility | Home |
|--------|----------------|------|
| Identity & RBAC | Login, MFA, OAuth, roles, permissions, module members | Foundation |
| Workflow | Definitions, instances, approvals, escalation via `workflow_gate` | Foundation + `platform/policies` |
| Notification / Email | Templates, events, deliveries, Graph send, FCM devices | Foundation + Email UI · `PlatformNotifyFacade` |
| Audit | Immutable mutation/event logs | Foundation · `PlatformAuditFacade` |
| Transactional outbox | Reliable side effects (notify/audit/finance/integration/domain) | `platform/outbox` + Celery drain |
| Numbering SSOT | Document sequences | `FndDocumentSequence` / platform numbering |
| Finance posting | Single GL posting path | `IFinancePosting` adapter |
| Inventory stock | Single stock mutation path | `IInventoryStock` adapter |
| Integration Hub | Connectors, webhooks, sync jobs, mappings, DLQ | Integration module |
| Document service | Versioned library consumed cross-module | Document module |
| Settings | System and tenant configuration | Foundation |
| SLO / metrics | Per-process samples · Prometheus text | `/platform/slo/*`, `/platform/metrics` |

```mermaid
flowchart TB
  M[Any Business Module] --> PLAT[platform ports facades]
  PLAT --> WF[Workflow Gate]
  PLAT --> OBX[Outbox]
  PLAT --> NUM[Numbering SSOT]
  PLAT --> FINP[Finance Posting]
  PLAT --> STK[Inventory Stock]
  OBX --> NTF[Notification]
  OBX --> AUD[Audit]
  OBX --> INT[Integration Hub]
  M --> DOC[Document Service]
  WF --> NTF
```"""

    if old_engines not in text:
        raise SystemExit("engines block not found")
    text = text.replace(old_engines, new_engines)

    text = text.replace(
        """### 11.26 Marketing & Social Media

| | |
|--|--|
| **Web** | Registry pending |
| **API** | `/marketing/*` (scaffolding) + CRM campaigns |
| **Maturity** | Partial / in progress |

**Features:** CRM campaigns; marketing FRD scope — platforms/accounts, content requests, AI/Celery generation pipeline, versions/scores, brand voice, research/trends, competitors, calendar, publish jobs (stub), analytics summary; ecommerce promos/coupons adjacent.

**Key flows:** Campaign → content request → generate → score → calendar → publish/approve.""",
        """### 11.26 Marketing & Social Media

| | |
|--|--|
| **Web** | `/marketing` |
| **API** | `/marketing/*` + CRM campaigns |
| **Maturity** | Implemented (workspace) · Partial vs full FRD depth |

**Features:** Platforms/accounts, content requests, AI/Celery generation pipeline, versions/scores, brand voice, research/trends, competitors, calendar, publish jobs, analytics summary; CRM campaigns; ecommerce promos/coupons adjacent.

**Key flows:** Campaign → content request → generate → score → calendar → publish/approve.

---

### 11.27 Platform AI surfaces (Agent / Voice / MCP)

| | |
|--|--|
| **Web** | `/voice-agent` (+ agent assistant UI) |
| **API** | `/voice_agent/*`, `agent_read`, `mcp_server` |
| **Maturity** | Partial / in progress |

**Features:** Voice-agent helpers; read-only agent query surface; MCP bootstrap mounted from API `main`. Full LLM gateway / RAG / Virtual E.A. remain roadmap (§12).""",
    )

    text = text.replace(
        "These are part of the product vision and ownership scope; not yet first-class API packages.",
        "These remain product vision for full GA. Thin API surfaces for agent/voice/MCP already exist (§11.27); Virtual E.A., full Licensing, and Backup & DR product modules are still roadmap.",
    )
    text = text.replace(
        "Ops today: PostgreSQL external hosting, manual dumps under `backups/`, SDD/DBS standards — product module still roadmap.",
        "Ops today: AWS RDS hosting on Coolify profile, `apps/api/scripts/restore_drill.py`, SDD/DBS standards — product Backup & DR module still roadmap.",
    )

    text = text.replace(
        """### 16.2 Current repo reality

| Present | Gap |
|---------|-----|
| Dockerfiles for api/web/employee-app | Full-stack prod Compose/Helm not checked in |
| Infra Compose (Redis, RabbitMQ, MinIO, OpenSearch) | Postgres assumed external / platform-provided |
| `.env.example` | No Terraform/EKS manifests yet |
| Coolify-style env used operationally | Formalize as one of the deploy profiles |

This master document defines the target; implementation closes the IaC/CI gaps without changing ADR-001/002.""",
        """### 16.2 Current repo reality (iConnect Plus)

| Present | Notes |
|---------|-------|
| Dockerfiles for api / web / employee-app | Roles: `api` / `worker` / `beat` / `migrate` |
| `docker-compose.local.yml` | All-in-one local stack |
| `docker-compose.infra.yml` / `docker-compose.app.yml` | Split infra vs app |
| `docker-compose.coolify.yml` | **Primary SaaS profile** — Redis, RabbitMQ, API, Celery, web, employee-app; RDS + S3 external |
| Public hosts | `iconnectplus.in` · `api.iconnectplus.in` · `ess.iconnectplus.in` |
| Landing access gate | Demo vs iConnectPlus codes → `/demo` or `/login` |
| Architecture CI gates | Cross-module ORM, permission catalog sync, OpenAPI opIds |
| Gap | Formal Terraform/EKS Helm charts; OpenSearch still gated |

This master document records **shipping reality** (Coolify) and the **locked target** (EKS when Tier D readiness is met) without changing ADR-001/002.""",
    )

    text = text.replace(
        """## 19. Document Hierarchy and Compliance

```text
BRD → FRD (Master + domain FRDs) → SDD v1.1 → DBS v1.1 → ERD → Physical Schema
    → SQLAlchemy Models → Alembic → OpenAPI → Code
```

| Document set | Path |
|--------------|------|
| BRD | `docs/01_BRD/` |
| FRD | `docs/02_FRD/` |
| SDD | `docs/03_SDD/` |
| DBS | `docs/04_DBS/` |
| Architecture Lock | `docs/05_ARCHITECTURE_LOCK/` |
| ERD | `docs/06_ERD/` |
| This master | `docs/07_MASTER_ARCHITECTURE/` |
| Design system | `design-system/enterprise-erp-platform/MASTER.md` |

No deviation from Architecture Lock v1.1 without EARB approval and an updated ADR.""",
        """## 19. Document Hierarchy and Compliance

```text
BRD → FRD (Master + domain FRDs) → SDD v1.1 → DBS v1.1 → Architecture Lock v1.1
                              ↘ Addendum v1.2 + docs/00_CURRENT (implementation)
    → ERD → Physical Schema → SQLAlchemy Models → Alembic → OpenAPI → Code
```

| Document set | Path |
|--------------|------|
| Living (as built) | `docs/00_CURRENT/` |
| BRD | `docs/01_BRD/` |
| FRD | `docs/02_FRD/` |
| SDD | `docs/03_SDD/` |
| DBS | `docs/04_DBS/` |
| Architecture Lock + Addendum | `docs/05_ARCHITECTURE_LOCK/` |
| ERD | `docs/06_ERD/` |
| This master | `docs/07_MASTER_ARCHITECTURE/` |
| Ops (Coolify, DC/SCM) | `docs/09_OPS/` |
| Design system | `design-system/enterprise-erp-platform/MASTER.md` |

Code must not violate the lock. When implementation advances the lock’s *remaining work* list, update Addendum v1.2 / `00_CURRENT` — do not silently edit the historical lock report. No deviation from Architecture Lock v1.1 without EARB approval and an updated ADR.""",
    )

    text = text.replace(
        "| Architecture lock | `docs/05_ARCHITECTURE_LOCK/ERP_Architecture_Lock_Report_v1.1.md` |\n| Infra Compose | `docker-compose.yml` |\n| API container entry | `apps/api/docker/entrypoint.sh` |",
        "| Architecture lock | `docs/05_ARCHITECTURE_LOCK/ERP_Architecture_Lock_Report_v1.1.md` |\n| Addendum v1.2 | `docs/05_ARCHITECTURE_LOCK/ERP_Architecture_Addendum_v1.2.md` |\n| Living system overview | `docs/00_CURRENT/SYSTEM_OVERVIEW.md` |\n| Module catalog | `docs/00_CURRENT/MODULE_CATALOG.md` |\n| Coolify deploy | `docs/09_OPS/coolify-deploy.md` |\n| Platform package | `apps/api/src/modules/platform/` |\n| Compose profiles | `docker-compose.local.yml` · `infra` · `app` · `coolify` |\n| API container entry | `apps/api/docker/entrypoint.sh` |",
    )

    text = text.replace(
        "*End of Master Architecture Document*",
        "*End of iConnect Plus Master Architecture Document*",
    )

    aws_marker = "## 15. AWS Deployment Plan\n\nPrimary cloud target per SDD Volume 4."
    aws_insert = """## 15. AWS Deployment Plan

### 15.0 Current SaaS profile (Coolify on EC2) — shipping now

Primary **shipping** path for iConnect Plus SaaS:

| Function | Choice |
|----------|--------|
| Orchestration | Coolify Compose (`docker-compose.coolify.yml`) on EC2 |
| Database | Amazon RDS PostgreSQL (`DATABASE_URL`) |
| Objects | Amazon S3 |
| Cache / broker | In-compose Redis + RabbitMQ |
| TLS / DNS | Coolify termination · Hostinger DNS → EC2 |
| Public apps | `iconnectplus.in` (web) · `api.iconnectplus.in` · `ess.iconnectplus.in` |

See [`docs/09_OPS/coolify-deploy.md`](../09_OPS/coolify-deploy.md).

### 15.1 Target cloud mapping (EKS/ECS) — gated

Primary **long-term** cloud target per SDD Volume 4. Do not treat EKS-only as mandatory until `modules/platform/evolution.py` Tier D readiness is true."""

    if aws_marker not in text:
        raise SystemExit("AWS marker not found")
    text = text.replace(aws_marker, aws_insert)

    text = text.replace("### 15.1 Service mapping", "### 15.2 Service mapping")
    text = text.replace("### 15.2 Target AWS topology", "### 15.3 Target AWS topology")
    text = text.replace("### 15.3 Network", "### 15.4 Network")
    text = text.replace("### 15.4 Kubernetes workload set", "### 15.5 Kubernetes workload set")
    text = text.replace(
        "### 15.5 Environment promotion (no calendar dates)",
        "### 15.6 Environment promotion (no calendar dates)",
    )
    text = text.replace(
        "### 15.6 SaaS control-plane concerns on AWS",
        "### 15.7 SaaS control-plane concerns on AWS",
    )

    text = text.replace(
        "| Telemetry | Structured logs, metrics, traces (OpenTelemetry) |\n| Compliance | Audit engine; GRC module; ISO 27001 / SOC 2 target for SaaS |",
        "| Telemetry | Structured logs, `/platform/metrics`, `/platform/slo/*`, traces (OpenTelemetry target) |\n| Architecture CI | Zero cross-module ORM outside adapters; permission catalog sync; OpenAPI uniqueness |\n| Compliance | Audit engine; GRC module; ISO 27001 / SOC 2 target for SaaS |",
    )

    text = text.replace(
        "| Backup/DR only manual today | Productize Backup & DR module; automate verify restores |\n| Licensing absent | Block sell-alone GA until entitlement service ships |",
        "| Backup/DR only manual today | Productize Backup & DR module; expand `restore_drill.py`; automate verify restores |\n| Licensing absent | Block sell-alone GA until entitlement service ships |\n| Coolify/EC2 single-node risk | Multi-AZ RDS; backups; plan EKS when Tier D ready |",
    )

    text = text.replace(
        """  subgraph platform [Platform]
    FND[Foundation Auth RBAC Workflow Notification Audit]
    ORG[Organization]
    MDM[Master Data]
    INT[Integration Hub]
  end""",
        """  subgraph platform [Platform]
    FND[Foundation Auth RBAC Workflow Notification Audit]
    PLAT[platform ports outbox SLO]
    ORG[Organization]
    MDM[Master Data]
    INT[Integration Hub]
  end""",
    )
    text = text.replace(
        "    AI[AI Virtual EA roadmap]",
        "    AI[Agent Voice MCP partial / EA roadmap]",
    )

    DST.write_text(text, encoding="utf-8", newline="\n")
    print(f"Wrote {DST} ({len(text.splitlines())} lines)")
    if not text.startswith("# iConnect Plus"):
        raise SystemExit("title check failed")
    if "Enterprise ERP Platform — Master Architecture Document" in text:
        raise SystemExit("old title still present")


if __name__ == "__main__":
    main()
