# Day-1 deploy (Docker Compose on Coolify host)

One-page checklist for `172.16.200.26`. Full reference: [COOLIFY.md](./COOLIFY.md).

## Prerequisites

- SSH user with Docker access on the Coolify server
- Coolify UI on port **8000** (do not publish ERP API on **8000**)
- Repo pushed to Git (or rsync from workstation) so `docker-compose.coolify.yml` exists on the server
- **`CORS_ORIGINS` must be a JSON array** in `.env.coolify`, e.g.  
  `CORS_ORIGINS=["http://172.16.200.26:3000","http://172.16.200.26:3001"]`

## Copy env from your workstation

`.env.coolify` is gitignored and contains secrets. After generating it locally:

```bash
scp .env.coolify user@172.16.200.26:/opt/enterprise-erp/.env.coolify
```

## Automated (on the server)

```bash
curl -fsSL https://raw.githubusercontent.com/ronanop/enterprise-erp/main/scripts/deploy/day1-coolify-compose.sh -o /tmp/day1.sh
# Or clone repo first, then:
bash /opt/enterprise-erp/scripts/deploy/day1-coolify-compose.sh
```

Place `.env.coolify` in `/opt/enterprise-erp/` before running (see below).

## Manual steps

```bash
ssh <user>@172.16.200.26
sudo mkdir -p /opt/enterprise-erp && sudo chown $USER:$USER /opt/enterprise-erp
cd /opt/enterprise-erp
git clone https://github.com/ronanop/enterprise-erp.git .
# copy .env.coolify from workstation (scp)
docker compose -f docker-compose.coolify.yml --env-file .env.coolify up -d --build
docker compose -f docker-compose.coolify.yml --env-file .env.coolify logs -f api
```

## From Windows (after SSH key works)

```powershell
$env:COOLIFY_SSH = "youruser@172.16.200.26"
.\scripts\deploy\push-day1-to-server.ps1
```

## Verify

| Service | URL |
|---------|-----|
| API health | http://172.16.200.26:8081/api/v1/health |
| Admin | http://172.16.200.26:3000 |
| Employee | http://172.16.200.26:3001 |

## Firewall

Allow inbound **3000**, **3001**, **8081** on the server for LAN clients (Coolify uses **8000** / **8080**).

## Seed demo logins (required after first deploy)

Migrations create schema and permissions only — they do **not** create `admin@example.com`. After the API is healthy:

```bash
docker compose -f docker-compose.coolify.yml --env-file .env.coolify exec api \
  python -m scripts.seed_demo_data
```

Then sign in at http://172.16.200.26:3000 with **admin@example.com** / **Secure1!** (same password for module demo users).

## If migrations fail on a fresh database

Reset volumes and retry once (destroys DB data):

```bash
docker compose -f docker-compose.coolify.yml --env-file .env.coolify down -v
docker compose -f docker-compose.coolify.yml --env-file .env.coolify build api web employee-app
docker compose -f docker-compose.coolify.yml --env-file .env.coolify up -d
```

If Alembic still errors, check `docker compose ... logs api` and fix migration order in the repo before production cutover.
