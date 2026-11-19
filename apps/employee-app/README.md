# Employee App (PWA)

Mobile-first employee self-service app for the Enterprise ERP platform.

It talks **only** to the FastAPI backend at `cache_erp_hrms_payroll` (`/api/v1`). It does **not** connect to PostgreSQL and does **not** modify `apps/web`.

## Features

- Sign in with ERP credentials (`/auth/login`)
- Profile (`/ess/me`)
- Leave balances + apply (`/ess/leave-*`)
- Attendance punch (`/ess/attendance/punch`)
- Payslips (`/ess/payslips`)
- Installable PWA (standalone display, offline shell)
- App icons (192 / 512 / maskable) + branded UI icons in bottom nav
- **Demo mock data** (`NEXT_PUBLIC_USE_MOCK=true`) for easy walkthroughs

Regenerate icons: `npm run icons`

### Demo mode

With `NEXT_PUBLIC_USE_MOCK=true` (default in `.env.example`):

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
| Password | `Secure1!` |

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
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | `Employee App` |

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
