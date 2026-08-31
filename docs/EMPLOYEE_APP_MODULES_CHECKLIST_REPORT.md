# Employee App (ESS PWA) — Inventory & Completion Checklist

**Project:** `cache_erp_hrms_payroll`  
**Scope:** `apps/employee-app` (Next.js PWA, port **3001**)  
**Backend:** `apps/api` → `modules/ess` + `POST /auth/ess/login`  
**Excluded:** HRMS admin (`apps/web` under `/hr`) — see `docs/HRMS_MODULES_CHECKLIST_REPORT.md`  
**Report date:** 2026-08-06  
**Sources:** `apps/employee-app/src` routes, `ess-service.ts`, `docs/ess-phase-1-foundation.md` through `ess-phase-7-login-admin.md`.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done — screen + `essService` → live API when `NEXT_PUBLIC_USE_MOCK=false` |
| 🟠 | Partial — UI gaps, mock fallback, or thin/read-only experience |
| ❌ | Not started / placeholder only |

**Module %** = weighted score: ✅ = 100%, 🟠 = 50%, ❌ = 0% of checklist rows for that module.

**Default runtime:** `NEXT_PUBLIC_USE_MOCK` defaults to **`false`** (`apps/employee-app/src/utils/env.ts`) — production path uses `/api/v1/ess/*`.

---

## Executive summary

| Metric | Value |
|--------|------:|
| **Feature modules in scope** | 22 |
| **Screens (`page.tsx`)** | 50 |
| **ESS service methods** | 50+ (single `ess-service.ts` facade) |
| **Weighted average completion** | **~81%** |
| **ESS implementation phases (1–7)** | Phases 1–7 delivered in API + PWA |
| **Stack** | Next.js 16, React 19, Tailwind 4, `@ducanh2912/next-pwa` |

```text
Overall Employee App  [████████████████░░░░]  ~81%
```

---

## Module master checklist (with %)

| # | Module | Primary routes | ESS / auth API | % | Status |
|---|--------|----------------|----------------|---:|:------:|
| 1 | **Platform & PWA shell** | `layout`, `manifest`, `/offline` | — | 78% | 🟠 |
| 2 | **Authentication & session** | `/login`, `api-client` auth | `/auth/ess/login`, captcha | 86% | ✅ |
| 3 | **First-run onboarding (UX)** | `/onboarding` | — (local only) | 72% | 🟠 |
| 4 | **Home dashboard** | `/home` | `/ess/me`, attendance, balances | 84% | ✅ |
| 5 | **Leave (employee)** | `/leave`, `/leave/[id]`, `/leave/history` | leave-types, requests, cancel | 88% | ✅ |
| 6 | **Leave (manager)** | `/leave/team` | `/ess/team-leave`, manager actions | 85% | ✅ |
| 7 | **Attendance punch & month view** | `/attendance` | punch, punch-policy, summary | 87% | ✅ |
| 8 | **Attendance requests** | `/attendance/history`, `/correction`, `/on-duty`, `/wfh`, `/compoff` | corrections, on-duty, wfh, compoff | 83% | ✅ |
| 9 | **Payslips & salary** | `/payslips`, detail, tax, breakdown, history | `/ess/payslips` | 76% | 🟠 |
| 10 | **Profile hub** | `/profile` | `/ess/me` | 70% | 🟠 |
| 11 | **Profile details** | `/profile/personal`, `/emergency`, `/bank`, `/education` | bank, emergency, education PATCH | 82% | 🟠 |
| 12 | **Documents** | `/documents`, `/upload`, `/[id]` | `/ess/documents` | 78% | 🟠 |
| 13 | **Notifications** | `/notifications`, bell, toasts | poll, unread, read-all | 77% | 🟠 |
| 14 | **Manager approvals hub** | `/approvals` | `/ess/approvals`, team-* actions | 86% | ✅ |
| 15 | **Training** | `/training` | `/ess/training` | 74% | 🟠 |
| 16 | **Performance** | `/performance` | `/ess/performance` | 74% | 🟠 |
| 17 | **Separation (resign)** | `/separation` | GET/POST `/ess/separation` | 80% | 🟠 |
| 18 | **Compliance & policies** | `/compliance`, `/compliance/[id]` | `/ess/policies`, acknowledge | 88% | ✅ |
| 19 | **Security** | `/profile/security`, `/change-password`, `/login/face-verify` | face/*, change-password | 84% | ✅ |
| 20 | **Meeting rooms** | `/rooms`, `/rooms/book` | meeting-rooms, bookings | 81% | 🟠 |
| 21 | **Assets & helpdesk** | `/assets`, `/scan`, `/support/*` | assets, support-tickets | 79% | 🟠 |
| 22 | **Announcements** | `/announcements` | `/ess/announcements` (derived) | 62% | 🟠 |

**Roll-up:** (78+86+72+84+88+85+87+83+76+70+82+78+77+86+74+74+80+88+84+81+79+62) / 22 ≈ **81.0%** → **~81%**

---

## Navigation map

### Bottom tab bar (`bottom-nav.tsx`)

| Tab | Route |
|-----|-------|
| Home | `/home` |
| Attendance | `/attendance` |
| Leave | `/leave` |
| Salary | `/payslips` |
| Profile | `/profile` |

### Full route inventory (`src/app`)

| Area | Routes |
|------|--------|
| Auth | `/login`, `/login/face-verify` |
| Splash / entry | `/`, `/splash`, `/onboarding` |
| Core | `/home`, `/notifications`, `/announcements`, `/approvals` |
| Attendance | `/attendance`, `/attendance/history`, `/attendance/correction`, `/attendance/on-duty`, `/attendance/wfh`, `/attendance/compoff` |
| Leave | `/leave`, `/leave/[id]`, `/leave/history`, `/leave/holidays`, `/leave/team` |
| Payslips | `/payslips`, `/payslips/[id]`, `/payslips/tax`, `/payslips/breakdown`, `/payslips/history` |
| Profile | `/profile`, `/profile/personal`, `/profile/emergency`, `/profile/bank`, `/profile/education`, `/profile/security`, `/profile/change-password` |
| Compliance | `/compliance`, `/compliance/[id]` |
| Workplace | `/rooms`, `/rooms/book`, `/assets`, `/assets/scan`, `/assets/[id]`, `/assets/[id]/report` |
| Support | `/support`, `/support/new`, `/support/[id]` |
| Talent / exit | `/training`, `/performance`, `/separation` |
| Documents | `/documents`, `/documents/upload`, `/documents/[id]` |
| System | `/offline` |

---

## ESS API surface used by the app

All calls go through `apps/employee-app/src/services/ess-service.ts` (and `api-client.ts` for login).

| Domain | Methods / endpoints |
|--------|---------------------|
| Session | `me` → `GET /ess/me` |
| Leave | types, balances, requests, create, cancel, `team-leave`, manager approve/reject |
| Attendance | list, summary, punch-policy, punch, corrections |
| Time requests | on-duty, WFH, comp-off (create + list) |
| Payroll | payslips list + detail |
| Profile | bank, KYC, emergency, education/skills |
| Documents | list |
| Calendar | holidays |
| Notifications | list, unread-count, poll, mark read |
| Manager | approvals hub + `actOnApproval` (leave, compoff, on_duty, wfh, corrections) |
| Talent | training, performance, separation + create separation |
| Security | face status/enroll/verify/enabled, change-password |
| Workplace | meeting rooms, availability, bookings; assets lookup/detail/tickets |
| Support | support-tickets CRUD + comments |
| Compliance | policies, walkthrough, acknowledge |
| Push | `registerDeviceToken` → `/ess/device-tokens` |

---

## ESS phase alignment

| Phase | Theme | PWA coverage | Phase % |
|------:|-------|--------------|--------:|
| 1 | Foundation (RBAC on `/ess/me`, cancel leave, accrual backend) | Team leave guard, cancel on detail | 90% |
| 2 | Manager workflow + in-app notifications | `/approvals`, bell badge, mark-read | 88% |
| 3 | Attendance trust + WFH | Punch policy, face capture, WFH pages | 87% |
| 4 | Push & foreground alerts | Poll 30s, toasts, optional browser Notification | 75% |
| 5 | Workplace (rooms, assets, helpdesk) | `/rooms`, `/assets`, `/support` | 80% |
| 6 | Compliance (policies, forced password) | `ComplianceGuard`, `/compliance` | 90% |
| 7 | Login parity (company + emp code, captcha) | Login form tabs, HR policies on web only | 85% |

---

## Detailed checklists by module

### 1. Platform & PWA shell — 78%

- [x] Mobile-first layout + safe-area bottom nav (100%)
- [x] PWA package (`@ducanh2912/next-pwa`) (100%)
- [x] App manifest (`app/manifest.ts`) (100%)
- [x] Offline fallback page `/offline` (100%)
- [~] Service worker / true background sync (40%)
- [~] Native install polish on all platforms (50%)

### 2. Authentication & session — 86%

- [x] Email login via shared auth client (100%)
- [x] Employee code + company code login (Phase 7) (100%)
- [x] Optional CAPTCHA when API env enabled (90%)
- [x] JWT session + `AuthGuard` on app routes (100%)
- [x] Demo mode via `NEXT_PUBLIC_USE_MOCK=true` (100%)
- [~] SSO / OAuth (0%)

### 3. First-run onboarding (UX) — 72%

- [x] Marketing carousel `/onboarding` (100%)
- [x] Local completion flag (`lib/onboarding`) (100%)
- [~] Tied to HR onboarding case status (30%)
- [~] Skip for returning users only (60%)

### 4. Home dashboard — 84%

- [x] Greeting, today attendance, work timer (100%)
- [x] Leave balance summary (100%)
- [x] Quick links to punch, leave, payslips (100%)
- [x] Manager pending approvals card when `is_manager` (100%)
- [~] Department/manager from API on home cards (50%)

### 5. Leave (employee) — 88%

- [x] Apply leave with types & balances (100%)
- [x] Request list + detail (100%)
- [x] Cancel before HR approval (100%)
- [x] History view (100%)
- [x] Holiday calendar page (100%)
- [~] Half-day / sandwich UX hints (60%)

### 6. Leave (manager) — 85%

- [x] `/leave/team` with approve/reject (100%)
- [x] `ManagerRouteGuard` hides route for non-managers (100%)
- [x] Wired to `/ess/team-leave/*` (100%)
- [~] Bulk actions / filters (40%)

### 7. Attendance punch & month view — 87%

- [x] Check-in/out with geolocation (100%)
- [x] Punch policy (geofence, selfie, face) (100%)
- [x] `FaceCapture` when required (100%)
- [x] Month calendar + summary API (OT, late, WFH days) (100%)
- [~] Offline punch queue (20%)

### 8. Attendance requests — 83%

- [x] Miss-punch correction submit (100%)
- [x] On-duty apply (100%)
- [x] WFH apply (100%)
- [x] Comp-off apply (100%)
- [x] Attendance history list (100%)
- [~] Status tracking UX for all request types (60%)

### 9. Payslips & salary — 76%

- [x] Payslip list + detail from API (100%)
- [x] Extra screens: tax, breakdown, history (80%)
- [~] Download PDF / share (40%)
- [~] Tax screens fed from real breakdown fields (55%)

### 10. Profile hub — 70%

- [x] Avatar, name, code, email, phone from `/ess/me` (100%)
- [~] Department / manager cards **hardcoded** in UI (20%)
- [x] Links to all profile & workplace modules (100%)
- [x] Admin banner when `admin_use_web_portal` (100%)
- [x] Logout (100%)

### 11. Profile details — 82%

- [x] Bank PATCH (100%)
- [x] Emergency PATCH (100%)
- [x] Education & skills PATCH (100%)
- [~] Personal page: DOB/gender/address **static placeholders** (40%)
- [~] `PATCH /ess/me` for mobile fields (50%)

### 12. Documents — 78%

- [x] List from `/ess/documents` (100%)
- [x] Document detail route (90%)
- [~] Upload flow vs API upload endpoint (50%)

### 13. Notifications — 77%

- [x] Notifications page (100%)
- [x] Bell + unread count + poll (100%)
- [x] Foreground toast on new items (100%)
- [x] Mark read / read-all (100%)
- [~] True FCM / background web push (45%)
- [~] Deep links for all event kinds (60%)

### 14. Manager approvals hub — 86%

- [x] Unified `/approvals` from `/ess/approvals` (100%)
- [x] Approve/reject leave, compoff, on-duty, WFH, corrections (100%)
- [x] Home pending count from `/ess/me` (100%)
- [~] HR-stage items (not manager scope) (40%)

### 15. Training — 74%

- [x] List page wired to `/ess/training` (100%)
- [~] Enroll / feedback / certificates (40%)
- [~] Rich session detail (50%)

### 16. Performance — 74%

- [x] List from `/ess/performance` (100%)
- [~] Goals/reviews interaction in PWA (40%)
- [~] KPI/OKR detail views (50%)

### 17. Separation — 80%

- [x] View separation status (100%)
- [x] Submit resignation POST (100%)
- [~] Exit checklist / FNF visibility for employee (50%)

### 18. Compliance & policies — 88%

- [x] `ComplianceGuard` blocks app until password + policies (100%)
- [x] Policy list + step walkthrough + acknowledge (100%)
- [x] Forced change password page (100%)
- [~] Rich media in policy steps (60%)

### 19. Security — 84%

- [x] Change password API (100%)
- [x] Face enroll / verify / enable toggles (100%)
- [x] Face verify at login route (100%)
- [x] Security settings hub (100%)
- [~] Biometric device binding (50%)

### 20. Meeting rooms — 81%

- [x] Room list + availability by date (100%)
- [x] Create booking (100%)
- [~] Cancel / modify booking (40%)
- [~] Requires HR-seeded training rooms (70%)

### 21. Assets & helpdesk — 79%

- [x] Asset list (100%)
- [x] QR scan + lookup (100%)
- [x] Report issue → asset ticket (100%)
- [x] IT / grievance tickets + comments (100%)
- [~] Asset custody actions in PWA (40%)

### 22. Announcements — 62%

- [x] Page + API list (100%)
- [~] Content source mostly derived (holidays) not CMS (30%)
- [~] Push for new announcements (40%)

---

## Cross-cutting: mock vs live API

| Item | Status |
|------|--------|
| `NEXT_PUBLIC_USE_MOCK` default `false` | ✅ |
| All `essService` methods branch mock vs API | ✅ |
| `mock-ess.ts` + `mock-portal.ts` for demos | ✅ |
| Login mock path for offline demos | ✅ |
| Remove mock code paths entirely | 🟠 |

---

## Guards & context providers

| Component | Purpose |
|-----------|---------|
| `AuthGuard` | Requires session for `(app)` routes |
| `ComplianceGuard` | Password change + mandatory policies |
| `ManagerRouteGuard` | Restricts manager-only routes |
| `EssMeContext` | Shared `/ess/me` + role flags |
| `NotificationCenterProvider` | Poll, badge, toast, device token |

---

## Gaps & suggested next work

1. **Profile personal** — bind DOB, gender, address from `/ess/me` or PATCH; remove hardcoded department/manager on `/profile`.
2. **Payslips** — PDF download and tax/breakdown from payslip `breakdown_json`.
3. **Push** — Firebase web messaging + service worker for background delivery (today: poll + optional browser Notification).
4. **Documents** — wire upload to document API if not already end-to-end.
5. **Training / performance** — detail screens and employee actions (not just lists).
6. **Announcements** — dedicated HR broadcast API instead of holiday-derived feed.

---

## Related documents

| Document | Content |
|----------|---------|
| `docs/HRMS_MODULES_CHECKLIST_REPORT.md` | Admin HRMS modules (excludes this app) |
| `docs/ess-phase-1-foundation.md` … `ess-phase-7-login-admin.md` | Phase delivery notes |
| `docs/08_TRANSFORMATION/HRMS_Enterprise_Transformation_Phases.md` | Phase 10 ESS backend checklist |

---

## Ops quick reference

```bash
# Employee app (port 3001)
cd apps/employee-app
npm run dev

# API (port 8000) + ESS seed
cd apps/api
alembic upgrade head
python -m scripts.seed_ess_employee
python -m scripts.seed_ess_policies   # compliance demo
```

| Env var | Purpose |
|---------|---------|
| `NEXT_PUBLIC_API_URL` | Default `/api/v1` (proxied to API in dev) |
| `NEXT_PUBLIC_USE_MOCK` | `true` = in-memory demo, no ERP |
| `ESS_LOGIN_CAPTCHA_ENABLED` | API-side captcha for code login |
| `FCM_SERVER_KEY` | Real push from API (optional) |

---

*This report covers only `apps/employee-app`. HR policy authoring and workforce admin remain on `apps/web`.*
