# iConnect Plus

Multi-Industry, Multi-Company, Enterprise-Grade ERP Platform.

**Architecture Baseline:** v1.1 — LOCKED · **Addendum:** v1.2 (implementation reality)  
**Product:** iConnect Plus / Connect Plus (B2B SaaS admin)

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16+, TypeScript, Tailwind CSS, ShadCN UI |
| Backend | Python 3.13+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, Celery |
| Database | PostgreSQL |
| Objects | MinIO (local / on-prem) · AWS S3 (cloud) |
| Antivirus | ClamAV (upload scanning) |
| Cache / Queue | Redis, RabbitMQ |
| Auth | User id + password (HRMS-synced logins) · JWT in **HttpOnly cookies** |
| Deploy | Docker Compose · Coolify on EC2 (`docker-compose.coolify.yml`) |

**Pattern:** Clean Architecture · DDD · Modular Monolith  
**Backend flow:** Router → Service → Repository → Database  
**Platform seams:** `apps/api/src/modules/platform` (ports, outbox, numbering, approvals, encryption, SLOs)

OpenSearch / Kubernetes / microservice extract remain **gated** (`modules/platform/evolution.py`).

## Documentation

| Document | Path |
|----------|------|
| **Start here (current system)** | [`docs/00_CURRENT/`](docs/00_CURRENT/) |
| Docs map | [`docs/README.md`](docs/README.md) |
| BRD / FRD / SDD / DBS | `docs/01_BRD` … `docs/04_DBS` |
| Architecture Lock + Addendum | `docs/05_ARCHITECTURE_LOCK/` |
| Master architecture | `docs/07_MASTER_ARCHITECTURE/` |
| Coolify deploy | `docs/09_OPS/coolify-deploy.md` |
| DC challan ↔ SCM | `docs/09_OPS/dc-challan-scm-contract.md` |

## Repository structure

```text
enterprise-erp/
├── apps/
│   ├── api/                 # FastAPI backend (modules/*, alembic, workers)
│   ├── web/                 # Next.js admin UI
│   ├── employee-app/        # Employee PWA (optional)
│   └── employee-mobile/
├── design-system/           # UI/UX Pro Max — iConnect Plus
├── docker/                  # MinIO build contexts
├── docs/                    # Baseline pack + living 00_CURRENT
├── docker-compose.local.yml
├── docker-compose.infra.yml
├── docker-compose.app.yml
├── docker-compose.coolify.yml
└── .env.example
```

### Backend modules (high level)

Foundation · Organization · Master Data · **Platform** · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · ESS · Payroll · Recruitment · Project · Asset · Service · Helpdesk · Document · Marketing · GRC · Analytics · Integration · Ecommerce · Portal · Voice Agent · Agent Read  

See [`docs/00_CURRENT/MODULE_CATALOG.md`](docs/00_CURRENT/MODULE_CATALOG.md).

## Quick start (local Docker)

### 1. Environment

```bash
cp .env.example .env
```

Important knobs:

| Variable | Local typical | Notes |
|----------|---------------|--------|
| `OBJECT_STORAGE_BACKEND` | `s3` / `minio` | S3-compatible via MinIO |
| `S3_ENDPOINT_URL` | `http://localhost:9000` | Compose uses `http://minio:9000` in-network |
| `CLAMAV_ENABLED` | `true` | Upload AV |
| `FIELD_ENCRYPTION_KEYS` | set in non-dev | Comma-separated; first encrypts, all decrypt |
| `INTEGRATION_OUTBOUND_ALLOWED_HOSTS` | set outside dev | Webhook SSRF allowlist |
| `API_RATE_LIMIT` | `0` local / `300`+ prod | Dashboard fans out many GETs |
| `API_WRITE_RATE_LIMIT` | `120` | Data-entry flood protection |
| `API_UPLOAD_RATE_LIMIT` | `30` | Multipart + upload-path JSON |
| `AUTH_COOKIE_*` | HttpOnly cookies | Sessions are cookie-based |

### 2. Start

```bash
docker compose -f docker-compose.local.yml up -d --build
```

| Service | URL / port |
|---------|------------|
| Web | http://localhost:3000 |
| API | http://localhost:8000 · `/api/v1/health` |
| Postgres | `localhost:5433` |
| Redis | `localhost:6379` |
| RabbitMQ | `localhost:5672` · UI `:15672` |
| MinIO | API `:9000` · Console `:9001` |
| ClamAV | `localhost:3310` |

### 3. Sign-in

Sign in at http://localhost:3000/login with your email ID or employee code and password.  
Create the first ERP admin with `python -m scripts.bootstrap_erp_admin --email … --password …` (from `apps/api`) — admin status is stored in the database (`user_type`), not env.  
ERP admins sync logins from HRMS (Organization → Users) and grant module Admin / User access.  
Tokens are **HttpOnly cookies** — not `localStorage`.

## Compose files

| File | Use |
|------|-----|
| `docker-compose.local.yml` | Full local stack |
| `docker-compose.infra.yml` | Infra only on a shared host |
| `docker-compose.app.yml` | App containers against external infra |
| `docker-compose.coolify.yml` | Coolify / production-style |

MinIO images are **built from source** under `docker/minio` (public Hub images were removed).

## Host-based API / Web (optional)

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn main:app --reload --reload-dir src --host 0.0.0.0 --port 8000 --app-dir src
```

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Biometric punches auto-fetch every 1 minute via Celery beat (`hr.biometric_fetch_punches`). Without Celery, run the always-on script from `apps/api`:

```powershell
.\scripts\run_fetch_biometric_punches.ps1
```

## Quality checks

```bash
cd apps/api
ruff check src
pytest src/tests/unit/platform   # architecture / security gates
```

```bash
cd apps/web
npm run lint
npm run typecheck
```

## Development rules

- Router → Service → Repository → Database  
- No business logic in routers · no UI→DB  
- Alembic only for schema  
- UUID / audit / tenant / soft-delete (DBS)  
- Do not bypass Workflow, Notification, or Audit engines  
- Cross-module data via **ports/adapters** or `master_data.published` — not foreign ORM  

## Remotes

| Remote | Role |
|--------|------|
| `origin` (GitHub) | Primary — default push (also syncs iConnectPlus mirror via push URL) |
| `iconnectplus` | Always-synced mirror of origin |
| `gitlab` | Mirror — only when explicitly requested |

## License

Proprietary — Internal Use Only
