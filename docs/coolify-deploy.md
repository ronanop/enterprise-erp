# Coolify deployment

Use **Docker Compose** mode in Coolify with compose file:

```text
docker-compose.coolify.yml
```

Coolify terminates HTTPS. Stack includes **Redis + RabbitMQ + API + Celery + Web**.
Postgres = **AWS RDS** via `DATABASE_URL`. Object storage = local or **AWS S3**.

## Services to expose

| Coolify service | Port | Domain example |
|-----------------|------|----------------|
| `web` | 3000 | `https://erp.example.com` |
| `api` | 8000 | `https://api.erp.example.com` |

Point `NEXT_PUBLIC_API_URL` at the **public** API URL (includes `/api/v1`).

## Required environment variables

```bash
# AWS RDS (security group must allow Coolify EC2 → 5432)
DATABASE_URL=postgresql+psycopg://USER:PASS@YOUR_RDS_HOST:5432/DBNAME?sslmode=require

# Auth
JWT_SECRET_KEY=long-random-string

# Public URLs
NEXT_PUBLIC_API_URL=https://api.erp.example.com/api/v1
FRONTEND_URL=https://erp.example.com
CORS_ORIGINS=["https://erp.example.com"]

# In-compose RabbitMQ
RABBITMQ_USER=erp
RABBITMQ_PASSWORD=strong-password
CELERY_BROKER_URL=amqp://erp:strong-password@rabbitmq:5672//

# Storage
OBJECT_STORAGE_BACKEND=local
ASSET_STORAGE_BACKEND=local
```

Optional S3:

```bash
OBJECT_STORAGE_BACKEND=s3
ASSET_STORAGE_BACKEND=s3
S3_BUCKET=your-bucket
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

## If deploy hangs on Waiting for api

1. Open **api** container logs in Coolify
2. Look for `Running Alembic migrations` then either `Migrations complete` or an ERROR
3. If connection times out: add Coolify EC2 security group to RDS inbound **5432**

## After first deploy

1. API logs show `Starting uvicorn`
2. `https://api…/api/v1/health` returns OK
3. Web loads
