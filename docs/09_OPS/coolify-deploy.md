# Coolify deployment

Use **Docker Compose** mode in Coolify with compose file:

```text
docker-compose.coolify.yml
```

Coolify terminates HTTPS. Stack includes **Redis + RabbitMQ + API + Celery + Web (HRMS admin)**.
Postgres = **AWS RDS** via `DATABASE_URL`. Object storage = **AWS S3**.

## Public domain (Hostinger → Coolify)

HRMS admin is a single Next app (`apps/web`):

| Hostinger DNS | Points to | Coolify service |
|---------------|-----------|-----------------|
| `iconnectplus.in` / `www` | Coolify EC2 (A/CNAME) | `web:3000` |
| `api.iconnectplus.in` | Coolify EC2 | `api:8000` |

Landing (`/`) → **Sign in** → access code → **demo** (`/demo`) or **iConnectPlus** (`/login`).

## Services to expose

| Coolify service | Port | Domain example |
|-----------------|------|----------------|
| `web` | 3000 | `https://iconnectplus.in` |
| `api` | 8000 | `https://api.iconnectplus.in` |

Point `NEXT_PUBLIC_API_URL` at the **public** API URL (includes `/api/v1`), or use same-origin `/api/v1` via Next rewrites when web proxies to API.

## Required environment variables

```bash
# AWS RDS (security group must allow Coolify EC2 → 5432)
DATABASE_URL=postgresql+psycopg://USER:PASS@YOUR_RDS_HOST:5432/DBNAME?sslmode=require

# Auth
JWT_SECRET_KEY=long-random-string

# Public URLs
NEXT_PUBLIC_API_URL=https://api.iconnectplus.in/api/v1
FRONTEND_URL=https://iconnectplus.in
CORS_ORIGINS=["https://iconnectplus.in","https://www.iconnectplus.in"]
SMTP_HOST=smtp.yourcompany.com
SMTP_FROM_ADDRESS=noreply@yourcompany.com

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
3. If connection times out: add Coolify EC2 security group to RDS inbound **5432**

## After first deploy

1. API logs show `Starting uvicorn`
2. `https://api.iconnectplus.in/api/v1/health` returns OK
3. Landing loads; Sign in accepts both codes
4. Demo code → demo shell; iConnectPlus code → ERP sign-in page
