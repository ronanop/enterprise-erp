# Coolify deployment

## SaaS (single host + AWS)

Use **Docker Compose** mode in Coolify with compose file:

```text
docker-compose.coolify.yml
```

Coolify terminates HTTPS. Stack includes **Redis + RabbitMQ + API + Celery + Web + Employee App**.
Postgres = **AWS RDS** via `DATABASE_URL`. Object storage = **AWS S3**.

## Path B — on-prem test (3 VMs, same Git repo)

Coolify does **not** place one compose across VMs. Create **three** Coolify Docker Compose resources that share the **same Git repo / branch**, each with a different compose file and server, and **auto-deploy on push** enabled.

### Test VM inventory

| Hostname | IP | Coolify resource | Compose file | Role |
|----------|----|------------------|--------------|------|
| test-app | `172.16.200.154` | `erp-test-app` | `docker-compose.coolify.yml` | Redis, RabbitMQ, API, Celery, Web, Employee App |
| test-minio | `172.16.200.155` | `erp-test-minio` | `docker-compose.test-minio.yml` | MinIO + bucket init |
| test-db | `172.16.200.156` | `erp-test-db` | `docker-compose.test-db.yml` | PostgreSQL only |

SSH OS users (`test-app` / `test-minio` / `test-db` and `root`) are managed outside this repo — **do not commit passwords**.

```text
Git push → Coolify webhook → redeploy each resource on its own VM
```

Cross-VM traffic uses **private IPs in env**, not Docker service names (`postgres` / `minio` only work inside one compose network).

### One-time Coolify setup

1. Install Coolify; add servers by IP (`172.16.200.154`, `.155`, `.156`) with SSH + Docker; validate green.
2. Create the three Compose resources above (same project/repo; different compose path + destination).
3. Firewall / LAN allow only:
   - `172.16.200.154` → `172.16.200.156:5432`
   - `172.16.200.154` → `172.16.200.155:9000` (and `9001` if console needed)
4. First deploy order: **db** → **minio** → **app**.

### Env on `erp-test-db` (`172.16.200.156`)

```bash
POSTGRES_USER=erp-postgres
POSTGRES_PASSWORD=strong-password
POSTGRES_DB=erp
# optional: POSTGRES_HOST_PORT=5432
```

### Env on `erp-test-minio` (`172.16.200.155`)

```bash
MINIO_ROOT_USER=erp_minio
MINIO_ROOT_PASSWORD=strong-password
S3_BUCKET=cache-erp-bucket
```

### Env on `erp-test-app` (`172.16.200.154` — remote DB + MinIO)

```bash
DATABASE_URL=postgresql+psycopg://erp-postgres:strong-password@172.16.200.156:5432/erp

OBJECT_STORAGE_BACKEND=minio
ASSET_STORAGE_BACKEND=minio
S3_ENDPOINT_URL=http://172.16.200.155:9000
S3_BUCKET=cache-erp-bucket
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=erp_minio
AWS_SECRET_ACCESS_KEY=strong-password

# In-compose broker (service DNS on test-app only)
RABBITMQ_USER=erp
RABBITMQ_PASSWORD=strong-password
CELERY_BROKER_URL=amqp://erp:strong-password@rabbitmq:5672//
REDIS_URL=redis://redis:6379/0

JWT_SECRET_KEY=long-random-string
# …plus public URLs / CORS / access codes as in SaaS section below
```

### Path B day-2 note

With auto-deploy on all three resources, a push that only changes app code may still **restart** Postgres and MinIO briefly. Data survives if named volumes are preserved. Prefer Coolify watch-path filters later if you want infra to redeploy only when its compose files change.

## Public domain (Hostinger → Coolify)

Marketing site + ERP web share one Next app; ESS is a separate Next app:

| Hostinger DNS | Points to | Coolify service |
|---------------|-----------|-----------------|
| `iconnectplus.in` / `www` | Coolify EC2 (A/CNAME) | `web:3000` |
| `api.iconnectplus.in` | Coolify EC2 | `api:8000` |
| `ess.iconnectplus.in` | Coolify EC2 | `employee-app:3001` |

Landing (`/`) → **Sign in** → access code → **demo** (`/demo`) or **iConnectPlus** (`/login`).
Employee self-service PWA: `https://ess.iconnectplus.in` (container port **3001**).

## Services to expose

| Coolify service | Port | Domain example |
|-----------------|------|----------------|
| `web` | 3000 | `https://iconnectplus.in` |
| `api` | 8000 | `https://api.iconnectplus.in` |
| `employee-app` | 3001 | `https://ess.iconnectplus.in` |

Point `NEXT_PUBLIC_API_URL` at the **public** API URL (includes `/api/v1`), or use same-origin `/api/v1` via Next rewrites when web/employee-app proxies to API.

## Required environment variables

```bash
# AWS RDS (security group must allow Coolify EC2 → 5432)
DATABASE_URL=postgresql+psycopg://USER:PASS@YOUR_RDS_HOST:5432/DBNAME?sslmode=require

# Auth
JWT_SECRET_KEY=long-random-string

# Public URLs
NEXT_PUBLIC_API_URL=https://api.iconnectplus.in/api/v1
FRONTEND_URL=https://iconnectplus.in
CORS_ORIGINS=["https://iconnectplus.in","https://www.iconnectplus.in","https://ess.iconnectplus.in"]
SMTP_HOST=smtp.yourcompany.com
SMTP_FROM_ADDRESS=noreply@yourcompany.com
NEXT_PUBLIC_APP_NAME_EMPLOYEE=Employee App
NEXT_PUBLIC_USE_MOCK=false
EMPLOYEE_APP_PORT=3001

# Landing access gate (two codes)
ACCESS_CODE_DEMO=your-sales-demo-code
ACCESS_CODE_CONNECTPLUS=your-internal-erp-code
ACCESS_GATE_TOKEN_HOURS=12

# In-compose RabbitMQ
RABBITMQ_USER=erp
RABBITMQ_PASSWORD=strong-password
CELERY_BROKER_URL=amqp://erp:strong-password@rabbitmq:5672//

# Storage
OBJECT_STORAGE_BACKEND=s3
ASSET_STORAGE_BACKEND=s3
S3_BUCKET=your-bucket
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

## Access gate behaviour

1. User opens `https://iconnectplus.in` and clicks **Sign in**.
2. Enters code → `POST /api/v1/public/access-gate/verify`.
3. **Demo code** → `/demo` (sales frontend, sample data only).
4. **iConnectPlus code** → `/login` (user id + password into live ERP).
5. Gate token is stored in `sessionStorage` and checked on `/demo` and `/login`.

## If deploy hangs on Waiting for api

1. Open **api** container logs in Coolify
2. Look for `Running Alembic migrations` then either `Migrations complete` or an ERROR
3. If connection times out:
   - SaaS: add Coolify EC2 security group to RDS inbound **5432**
   - Path B: confirm `DATABASE_URL` uses `<test-db-ip>:5432` and firewall allows `test-app` → `test-db:5432`

## After first deploy

1. API logs show `Starting uvicorn`
2. `https://api.iconnectplus.in/api/v1/health` returns OK
3. Landing loads; Sign in accepts both codes
4. Demo code → demo shell; iConnectPlus code → ERP sign-in page
