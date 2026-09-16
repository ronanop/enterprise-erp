# Coolify deployment

Use **Docker Compose** mode in Coolify with compose file:

```text
docker-compose.coolify.yml
```

Coolify terminates HTTPS. Default stack includes **Postgres + Redis + RabbitMQ + API + Celery + Web** (local file storage).

For AWS later: point `DATABASE_URL` at RDS and set `OBJECT_STORAGE_BACKEND=s3` plus S3 credentials.

## Services to expose

| Coolify service | Port | Domain example |
|-----------------|------|----------------|
| `web` | 3000 | `https://erp.example.com` |
| `api` | 8000 | `https://api.erp.example.com` |

Point `NEXT_PUBLIC_API_URL` at the **public** API URL (includes `/api/v1`).

## Required environment variables

Set these in the Coolify application environment (not in git):

```bash
# Must match the in-compose postgres service (or use an RDS URL instead)
POSTGRES_USER=erp
POSTGRES_PASSWORD=strong-password
POSTGRES_DB=erp
DATABASE_URL=postgresql+psycopg://erp:strong-password@postgres:5432/erp

# Auth
JWT_SECRET_KEY=long-random-string

# Public URLs (build + runtime)
NEXT_PUBLIC_API_URL=https://api.erp.example.com/api/v1
FRONTEND_URL=https://erp.example.com
CORS_ORIGINS=["https://erp.example.com"]

# RabbitMQ (in-stack)
RABBITMQ_USER=erp
RABBITMQ_PASSWORD=strong-password
CELERY_BROKER_URL=amqp://erp:strong-password@rabbitmq:5672//

# Storage (default local — optional AWS S3)
OBJECT_STORAGE_BACKEND=local
ASSET_STORAGE_BACKEND=local
```

Optional AWS S3:

```bash
OBJECT_STORAGE_BACKEND=s3
ASSET_STORAGE_BACKEND=s3
S3_BUCKET=your-bucket
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

Optional:

```bash
REDIS_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1
OPENSEARCH_URL=
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=https://api.erp.example.com/api/v1/auth/microsoft/callback
MICROSOFT_PLATFORM_ADMIN_EMAILS=techbank@cachedigitech.com,connectplus@cachedigitech.com
```

## After first deploy

1. Open Coolify → **api** container logs (look for `Migrations complete` / `Starting uvicorn`)
2. Confirm API health: `https://api…/api/v1/health`
3. Confirm web loads and can call the API

## Important Coolify env gotchas

- `DATABASE_URL` host must be `postgres` for the in-compose DB (not a missing hostname).
- `POSTGRES_PASSWORD` must match the password embedded in `DATABASE_URL`.
- If `OBJECT_STORAGE_BACKEND=s3` without `S3_BUCKET`, the API now falls back to local storage.

## Local LAN stack

Keep using `docker-compose.app.yml` on the office VM. Coolify uses
`docker-compose.coolify.yml` only.
