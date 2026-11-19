# Deploying on Coolify

This guide covers the **full Enterprise ERP stack** (API, Celery worker/beat, admin web, employee PWA, PostgreSQL, Redis, RabbitMQ) on a self-hosted [Coolify](https://coolify.io) instance.

## Prerequisites

- Coolify server with Docker (example panel: `http://172.16.200.26:8000/`)
- Git access to this repository
- **Do not** bind the ERP API to host port `8000` if Coolify UI uses it — use `8080` or Coolify’s reverse proxy
- RAM: **≥ 6 GB** without OpenSearch; **≥ 8 GB** with profile `full` (OpenSearch + MinIO)

## Repository artifacts

| Path | Purpose |
|------|---------|
| `docker-compose.coolify.yml` | One-click full stack |
| `.env.coolify.example` | Production env template |
| `apps/api/Dockerfile` | API + Celery image |
| `apps/api/docker/entrypoint.sh` | Migrations + api/worker/beat commands |
| `apps/web/Dockerfile` | Next.js admin (standalone) |
| `apps/employee-app/Dockerfile` | Employee PWA (standalone) |

## Option A — Docker Compose on the Coolify server

1. Clone the repo on the server (or use Coolify “Docker Compose” resource pointing at this file).

2. Configure environment:

   ```bash
   cp .env.coolify.example .env.coolify
   ```

   Edit `.env.coolify`:

   - Strong `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `JWT_SECRET_KEY`
   - `DATABASE_URL`, `CELERY_BROKER_URL` must use Docker service hostnames (`postgres`, `rabbitmq`, `redis`), not `localhost`
   - `CORS_ORIGINS` — include every browser origin (admin + employee URLs)
   - `NEXT_PUBLIC_API_URL` — URL **browsers** use to reach the API (e.g. `http://172.16.200.26:8080/api/v1`)
   - `API_PUBLISH_PORT` — default `8080` to avoid Coolify’s port `8000`

3. Build and start:

   ```bash
   docker compose -f docker-compose.coolify.yml --env-file .env.coolify up -d --build
   ```

4. Optional MinIO + OpenSearch:

   ```bash
   docker compose -f docker-compose.coolify.yml --env-file .env.coolify --profile full up -d --build
   ```

5. Verify:

   - API: `GET /api/v1/health` on the published API port
   - Admin: `WEB_PUBLISH_PORT` (default `3000`)
   - Employee: `EMPLOYEE_PUBLISH_PORT` (default `3001`)

## Option B — Separate Coolify applications (recommended for production)

Create one Coolify **project** and add resources from the same Git repo.

### 1. Data services

Add (or deploy via compose):

- PostgreSQL
- Redis
- RabbitMQ

Note internal hostnames Coolify assigns (often service name in the same network).

### 2. API application

| Setting | Value |
|---------|--------|
| Base directory | `apps/api` |
| Dockerfile | `Dockerfile` |
| Port | `8000` (container) |
| Health check | `/api/v1/health` |
| Pre-deploy / entrypoint | Migrations run when `RUN_MIGRATIONS=true` (default) |

**Start command:** use image default (`CMD ["api"]`) or entrypoint `api`.

**Environment:** copy API block from `.env.coolify.example`. Mount a **persistent volume** at `/app/var/crm-attachments` (or set `CRM_UPLOAD_ROOT`).

### 3. Celery worker

| Setting | Value |
|---------|--------|
| Same image/build as API | `apps/api/Dockerfile` |
| Custom command | `/entrypoint.sh worker` |
| `RUN_MIGRATIONS` | `false` |
| Volume | Same CRM uploads volume as API |

### 4. Celery beat

| Setting | Value |
|---------|--------|
| Same image as API | |
| Custom command | `/entrypoint.sh beat` |
| `RUN_MIGRATIONS` | `false` |

### 5. Admin web (`apps/web`)

| Setting | Value |
|---------|--------|
| Base directory | `apps/web` |
| Build args | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, demo vars if needed |
| Port | `3000` |

**Important:** `NEXT_PUBLIC_*` is fixed at **image build** time. Changing the API URL requires a **rebuild**.

### 6. Employee app (`apps/employee-app`)

| Setting | Value |
|---------|--------|
| Base directory | `apps/employee-app` |
| Build args | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_USE_MOCK=false` |
| Port | `3001` |

Assign domains in Coolify (HTTPS) and add those origins to `CORS_ORIGINS`.

## CORS and LAN access

- Set `CORS_ORIGINS` to a comma-separated list of frontend URLs.
- For private IPs, optionally set:

  ```env
  CORS_ORIGIN_REGEX=https?://(172\.16\.\d{1,3}\.\d{1,3}|localhost|127\.0\.0\.1)(:\d+)?
  ```

- In `development`, localhost is still allowed via regex when `CORS_ORIGIN_REGEX` is unset.

## Staging vs production

Use Coolify **environments** (or separate projects):

| | Staging | Production |
|---|---------|------------|
| `DEPLOY_ENV` / image tag | `staging` | `production` |
| `DEBUG` | `false` | `false` |
| `JWT_SECRET_KEY` | staging secret | unique strong secret |
| Demo `NEXT_PUBLIC_DEMO_*` | optional | leave empty |
| `EMAIL_DELIVERY_MODE` | `async` | `async` |
| Backups | weekly | daily + tested restore |

Use different databases and volumes per environment.

## Backups and persistence

| Data | Action |
|------|--------|
| PostgreSQL | Coolify backup or `pg_dump` on schedule; store off-server |
| `crm_uploads` volume | Filesystem/volume snapshot with DB |
| Redis / RabbitMQ | Usually ephemeral; persist only if you rely on non-replayable queues |
| MinIO (`profile full`) | Volume backup for `minio_data` |

**Restore drill:** quarterly restore Postgres + upload volume to a staging Coolify env.

## CRM uploads and MinIO

- Default: files on disk at `CRM_UPLOAD_ROOT` (`/app/var/crm-attachments` in Docker).
- `MINIO_*` variables prepare S3-compatible storage; wire new modules via `core.object_storage` when moving off local disk.
- API replicas require shared storage (MinIO/S3 or a shared volume).

## Troubleshooting

| Symptom | Check |
|---------|--------|
| 502 from Coolify proxy | API health, container logs, `DATABASE_URL` |
| CORS errors in browser | `CORS_ORIGINS` matches exact scheme/host/port |
| Frontend calls wrong API | Rebuild web/employee with correct `NEXT_PUBLIC_API_URL` |
| Migrations fail | Postgres reachable; run once: `docker compose run --rm api /entrypoint.sh migrate` |
| Celery idle | Worker logs, `CELERY_BROKER_URL`, RabbitMQ health |
| Uploads missing after redeploy | Persistent volume on API + worker |

## Local smoke test (before Coolify)

```bash
cp .env.coolify.example .env.coolify
# Adjust passwords and URLs for local Docker
docker compose -f docker-compose.coolify.yml --env-file .env.coolify up -d --build
curl -s http://localhost:8080/api/v1/health
```
