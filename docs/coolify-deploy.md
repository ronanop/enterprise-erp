# Coolify deployment (AWS RDS + S3)

Use **Docker Compose** mode in Coolify with compose file:

```text
docker-compose.coolify.yml
```

Coolify terminates HTTPS. This compose does **not** run nginx, MinIO, or Postgres.
Postgres = **AWS RDS**. Object storage = **AWS S3**. Redis + RabbitMQ run in the stack.

## Services to expose

| Coolify service | Port | Domain example |
|-----------------|------|----------------|
| `web` | 3000 | `https://erp.example.com` |
| `api` | 8000 | `https://api.erp.example.com` |

Point `NEXT_PUBLIC_API_URL` at the **public** API URL (includes `/api/v1`).

## Required environment variables

Set these in the Coolify application environment (not in git):

```bash
# AWS RDS
DATABASE_URL=postgresql+psycopg://USER:PASS@YOUR_RDS_HOST:5432/DBNAME?sslmode=require

# AWS S3
OBJECT_STORAGE_BACKEND=s3
ASSET_STORAGE_BACKEND=s3
S3_BUCKET=your-bucket
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Auth
JWT_SECRET_KEY=long-random-string

# Public URLs (build + runtime)
NEXT_PUBLIC_API_URL=https://api.erp.example.com/api/v1
FRONTEND_URL=https://erp.example.com
CORS_ORIGINS=["https://erp.example.com"]
MICROSOFT_REDIRECT_URI=https://api.erp.example.com/api/v1/auth/microsoft/callback

# RabbitMQ password for the in-stack broker (change from default)
RABBITMQ_USER=erp
RABBITMQ_PASSWORD=strong-password
CELERY_BROKER_URL=amqp://erp:strong-password@rabbitmq:5672//
```

Optional:

```bash
REDIS_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1
OPENSEARCH_URL=   # leave empty to skip
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_PLATFORM_ADMIN_EMAILS=techbank@cachedigitech.com,connectplus@cachedigitech.com
```

## RDS security group

Allow inbound **5432** from the Coolify EC2 security group (or private subnet).

## S3 IAM

The IAM user/role needs at least: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`,
`s3:ListBucket`, `s3:HeadBucket` on the bucket.

## After first deploy

1. Confirm API health: `https://api…/api/v1/health`
2. Confirm web loads and can call the API (CORS + `NEXT_PUBLIC_API_URL`)
3. Upload a CRM attachment and verify the object appears in S3 under `crm/attachments/`

## Local LAN stack

Keep using `docker-compose.app.yml` on the office VM. Coolify uses
`docker-compose.coolify.yml` only.
