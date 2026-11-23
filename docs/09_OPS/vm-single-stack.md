# VM single-stack go-live

One Compose file runs the full product on a VM and seeds the DB from local backups.

## What it includes

| Service | Role |
|---------|------|
| `postgres` | `erp_hrms` (app) + `erp` (full archive) |
| `db-seed` | Restores `backups/vm-seed-*.dump` once |
| `redis` / `rabbitmq` / `minio` | Cache, queue, object storage |
| `api` + `celery-worker` | FastAPI + workers (migrations on) |
| `web` | Next.js admin |
| `nginx` | Port **80** → web + `/api` |

## Prerequisites

- Docker + Compose v2 on the VM
- Repo checked out on the VM
- Seed dumps present (copy from your laptop if needed):

```text
backups/vm-seed-erp_hrms.dump   # active app DB (employees, org, HR…)
backups/vm-seed-erp.dump        # fuller archive DB
```

## Deploy

```bash
cp .env.vm.example .env.vm
# Set VM_HOST, FRONTEND_URL, CORS_ORIGINS, JWT_SECRET_KEY, SMTP if needed

bash scripts/deploy-vm.sh
```

Windows (build/test locally against the same compose):

```powershell
Copy-Item .env.vm.example .env.vm
.\scripts\deploy-vm.ps1
```

Open `http://<VM_HOST>/`.

## Re-seed (destructive)

```bash
docker compose -f docker-compose.vm.yml --env-file .env.vm down -v
# ensure backups/vm-seed-*.dump are in place
bash scripts/deploy-vm.sh
```

`down -v` removes Postgres volume and seed markers so restore runs again.

## Point app at the fuller `erp` DB

In `.env.vm`:

```bash
POSTGRES_DB=erp
```

Then recreate API containers (or full stack) so `DATABASE_URL` targets `erp`.
