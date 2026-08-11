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

For LAN/mobile testing (fewer connection aborts on Windows), use stable mode without auto-reload:

```powershell
.\scripts\dev-api-stable.ps1
```

Health: http://localhost:8000/api/v1/health

**Note:** Use `--reload-dir src` so saving files outside `apps/api/src` does not restart the API (which causes `ECONNRESET` on the employee app proxy).

**Windows `ConnectionAbortedError` / WinError 10053 spam:** Harmless noise when the ERP web app fires many parallel API requests and you stop or reload uvicorn (Ctrl+C). The API still works. Use `dev-api-stable.ps1` when testing from a phone on the network.

## 3. ERP web (port 3000)

```powershell
cd apps\web
copy .env.example .env.local   # first time only
npm run dev
```

- If Turbopack panics or 404 on `/login`: stop dev, then `npm run dev:clean`
- Stable alternative: `npm run dev:webpack`
- Or from repo root: `.\scripts\dev-web.ps1`

Dev server binds to **0.0.0.0** (LAN-accessible). After `npm run dev`, use the **Network** URL shown in the terminal (e.g. `http://192.168.x.x:3000`).

## 4. Employee app (port 3001)

```powershell
cd apps\employee-app
npm run dev:clean   # first run or after next.config changes
# day-to-day: npm run dev
```

Uses `/api/v1` proxy to the API (see `next.config.ts`). `turbopack.root` is set to this app folder (avoids wrong monorepo root / lockfile warning).

## LAN / network access

Both frontends listen on `0.0.0.0`. API already uses `--host 0.0.0.0` (port 8000).

| Service | Local | LAN (example) |
|---------|-------|----------------|
| ERP web | http://localhost:3000 | http://\<your-ip\>:3000 |
| Employee app | http://localhost:3001 | http://\<your-ip\>:3001 |
| API health | http://localhost:8000/api/v1/health | http://\<your-ip\>:8000/api/v1/health |

Find your IPv4: `ipconfig` → look for **IPv4 Address** on your Wi‑Fi/Ethernet adapter.

**Important:** Next.js may show a VMware/virtual **Network** URL (e.g. `192.168.40.1`). Use your **Wi‑Fi IP** instead (e.g. `172.16.x.x`). Run:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi|Ethernet' } | Select-Object InterfaceAlias, IPAddress
```

Then open `http://<wifi-ip>:3000` (or `:3001` for employee app) from other devices.

**API proxy on LAN:** Keep `NEXT_PUBLIC_API_URL=/api/v1` in `.env.local`. The Next.js server proxies to `127.0.0.1:8000` on the dev machine — phones/tablets on the same network do not need a direct API URL.

**HMR on LAN:** `allowedDevOrigins` in `next.config.ts` allows `192.168.*.*` and `10.*.*.*` by default. For Tailscale or other IPs, set in `.env.local`:

```env
ALLOWED_DEV_ORIGINS=100.64.0.5:3000
```

Restart the dev server after changing env or `next.config.ts`.

**Windows Firewall:** If the Network URL does not load from another device, allow Node.js through the firewall for private networks.

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
