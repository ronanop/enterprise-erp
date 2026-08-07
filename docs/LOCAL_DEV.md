# Local development (Windows)

## 1. Infrastructure

```powershell
cd D:\imp\cache_erp_hrms_payroll
docker compose up -d
docker compose ps   # erp-postgres should be healthy
docker exec erp-postgres pg_isready -U erp -d erp
```

If Postgres was already running, recreate it after `docker-compose.yml` changes:

```powershell
docker compose up -d --force-recreate postgres
```

## 2. API (port 8000)

```powershell
cd apps\api
# .venv activated
alembic upgrade head
uvicorn main:app --reload --reload-dir src --host 0.0.0.0 --port 8000 --app-dir src
```

Or from repo root: `.\scripts\dev-api.ps1`

Health: http://localhost:8000/api/v1/health

**Note:** Use `--reload-dir src` so saving files outside `apps/api/src` does not restart the API (which causes `ECONNRESET` on the employee app proxy).

## 3. ERP web (port 3000)

```powershell
cd apps\web
copy .env.example .env.local   # first time only
npm run dev
```

- If Turbopack panics or 404 on `/login`: stop dev, then `npm run dev:clean`
- Stable alternative: `npm run dev:webpack`

## 4. Employee app (port 3001)

```powershell
cd apps\employee-app
npm run dev:clean   # first run or after next.config changes
# day-to-day: npm run dev
```

Uses `/api/v1` proxy to the API (see `next.config.ts`). `turbopack.root` is set to this app folder (avoids wrong monorepo root / lockfile warning).

## Browser console noise

Errors at `page:68` / `runInjection` / `Content already injected` / `site-signal.top` come from **browser extensions**, not this repo. In dev, a filter in `<head>` reduces Next.js overlay noise; for a fully clean console, use InPrivate with extensions disabled or disable the offending extension (password manager / shopping / signal tools).

`Failed to proxy … ECONNREFUSED 127.0.0.1:8000` means the **API is not running**. Start Postgres (`docker compose up -d`) then `.\scripts\dev-api.ps1` and confirm http://localhost:8000/api/v1/health before using the apps.

By default, Next.js no longer forwards browser console output to the terminal (`logging.browserToTerminal` in `next.config.ts`). Set `NEXT_BROWSER_LOGS=1` when you need verbose browser logs in the terminal again.

## Login

| App | URL | API |
|-----|-----|-----|
| ERP | http://localhost:3000/login | `POST /api/v1/auth/login` |
| Employee | http://localhost:3001/login | `POST /api/v1/auth/ess/login` |

If login returns **503**, Postgres is down — fix Docker first.
