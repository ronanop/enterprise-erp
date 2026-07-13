# Enterprise ERP Platform

Multi-Industry, Multi-Company, Enterprise-Grade ERP Platform.

**Architecture Baseline:** v1.1 — LOCKED  
**Status:** Sprint 0 Foundation Complete

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16+, TypeScript, Tailwind CSS, ShadCN UI |
| Backend | Python 3.13+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, Celery |
| Database | PostgreSQL |
| Search | OpenSearch |
| Storage | MinIO / AWS S3 |
| Cache / Queue | Redis, RabbitMQ |
| Infrastructure | Docker, Kubernetes Ready, Terraform Ready |

**Pattern:** Clean Architecture · DDD · Modular Monolith

## Documentation

| Document | Path |
|----------|------|
| BRD | `docs/01_BRD/` |
| FRD | `docs/02_FRD/` |
| SDD v1.1 | `docs/03_SDD/` |
| DBS v1.1 | `docs/04_DBS/` |
| Architecture Lock | `docs/05_ARCHITECTURE_LOCK/` |

## Repository Structure

```text
enterprise-erp-platform/
├── apps/
│   ├── api/          # FastAPI backend
│   └── web/          # Next.js frontend
├── docs/             # Architecture documentation
├── docker-compose.yml
└── .env.example
```

## Quick Start

### 1. Environment

```bash
cp .env.example .env
```

### 2. Infrastructure (Docker)

```bash
docker compose up -d
```

Services: PostgreSQL, Redis, RabbitMQ, MinIO, OpenSearch

### 3. Backend API

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -e ".[dev]"
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8000 --app-dir src
```

API: http://localhost:8000/api/v1/health  
Docs: http://localhost:8000/docs

### 4. Frontend

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

App: http://localhost:3000

## Quality Checks

### Backend

```bash
cd apps/api
ruff check src
ruff format --check src
mypy src
pytest
```

### Frontend

```bash
cd apps/web
npm run lint
npm run typecheck
npm run build
```

## Development Rules

- **Backend flow:** Router → Service → Repository → Database
- **No business logic in routers**
- **No direct database access from UI**
- **Alembic migrations only** for schema changes
- **Follow DBS standards:** UUID PK, audit columns, tenant isolation, soft delete

## Sprint 0 Scope

Sprint 0 delivers platform foundation only:

- FastAPI bootstrap with `/api/v1` versioning
- SQLAlchemy + Alembic initialization
- Health check endpoint
- Next.js foundation with API client and layout shell
- Docker infrastructure services
- Quality tooling (ruff, mypy, pytest, eslint, typescript)

**Not in Sprint 0:** Authentication, RBAC, business modules, CRUD implementations.

## License

Proprietary — Internal Use Only
