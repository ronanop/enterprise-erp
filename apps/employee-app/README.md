# Employee App (PWA)

Mobile-first employee self-service app for the Enterprise ERP platform.

It talks **only** to the FastAPI backend at `cache_erp_hrms_payroll` (`/api/v1`). It does **not** connect to PostgreSQL and does **not** modify `apps/web`.

## Features

- Sign in with ERP credentials (`/auth/login`)
- Profile (`/ess/me`)
- Leave balances + apply + **cancel** pending requests (`POST /ess/leave-requests/{id}/cancel`)
- **RBAC hints** on `/ess/me` (`ess_role`, `is_manager`, `can_approve_team_leave`, `pending_approvals_count`)
- **Manager approvals** at `/approvals` (direct reports)
- **Notification bell** unread count (polls `/ess/notifications/unread-count`)
- Attendance punch (`/ess/attendance/punch`)
- Payslips (`/ess/payslips`)
- Installable PWA (standalone display, offline shell)
- App icons (192 / 512 / maskable) + branded UI icons in bottom nav
- **Face verification** (enroll in Profile → Security; required after login when enabled)
- **Live API** (`NEXT_PUBLIC_USE_MOCK=false`) — syncs with HRMS `/ess/*`

Regenerate icons: `npm run icons`

### Demo mode

With `NEXT_PUBLIC_USE_MOCK=true`:


| Field | Value |
|-------|--------|
| Email | `demo@company.com` |
| Password | `demo123` |

Sample employee **Riya Sharma** loads with leave balances, requests, payslips, and today checked in at **10:00 AM** so total time is easy to explain (e.g. 3:00 PM → **5:00 hours**).

Set `NEXT_PUBLIC_USE_MOCK=false` to use the live ERP API.

## Prerequisites

1. ERP API running on `http://localhost:8000`
2. `CORS_ORIGINS` includes `http://localhost:3001` (already in ERP `.env.example`)
3. Seed an ESS-linked employee (after `seed_demo_data`):

```bash
cd cache_erp_hrms_payroll/apps/api
python -m scripts.seed_ess_employee
```

### Demo login (Employee App)

| Field | Value |
|-------|--------|
| Email | `employee@example.com` |
| Password | Policy-compliant default: code + `@` + DOB (`DDMMYYYY`), e.g. `Emp004@07051994` for EMP-004 after `seed_hr_workforce` + `seed_ess_employee` (run seed script for exact value) |

Do **not** use `admin@example.com` for the PWA — that account is a platform admin and is not linked to an employee profile.

## Setup

```bash
cd employee-app
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Environment

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `/api/v1` (proxied to ERP in dev — use from localhost **or** LAN `:3001`) |
| `API_PROXY_TARGET` | `http://127.0.0.1:8000` (Next.js rewrite target; set in shell or `.env` when starting `npm run dev`) |
| `NEXT_PUBLIC_APP_NAME` | `Employee App` |

Direct browser calls to `http://localhost:8000` fail when you open the PWA via your PC’s LAN IP (e.g. on a phone). The `/api/v1` proxy avoids that.

## Install as PWA

1. Run a production build (`npm run build && npm run start`) — service worker is disabled in development
2. Open Chrome → address bar install icon, or **Add to Home Screen** on Android
3. App opens standalone at `/home`

## Smoke checklist

- [ ] Login with an employee-linked user
- [ ] Home shows profile + leave/payslip summary
- [ ] Apply leave request
- [ ] Punch in / punch out
- [ ] Open payslip list + detail
- [ ] Sign out
- [ ] Production build is installable

## Architecture

```text
employee-app (PWA :3001)
    │  JWT Bearer
    ▼
FastAPI /api/v1/ess/*  (+ /auth/*)
    │
    ▼
PostgreSQL (same ERP database)
```

Admin ERP UI remains at `apps/web` on port 3000.
