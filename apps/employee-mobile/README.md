# Employee Mobile (Expo)

React Native + Expo Router app for Employee Self-Service (ESS).

## Quick start

```bash
cd apps/employee-mobile
npm install
cp .env.example .env   # optional
npm start
```

**Demo login** (mock mode, default):

- Email: `demo@company.com`
- Password: `demo123`

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `EXPO_PUBLIC_USE_MOCK` | `true` | In-memory demo API |
| `EXPO_PUBLIC_API_URL` | `http://127.0.0.1:8000/api/v1` | Real ERP when mock is off |
| `EXPO_PUBLIC_APP_NAME` | `Employee Portal` | Display name |

For a physical phone against local ERP, set `EXPO_PUBLIC_API_URL` to your machine’s LAN IP and `EXPO_PUBLIC_USE_MOCK=false`.

## Phase status

### Phase 0 — Foundation
- Expo Router, SecureStore auth, login, tabs shell, theme/UI

### Phase 1 — Daily-use MVP
- Home, attendance punch/history, leave, payslips, profile, notifications, face verify

### Phase 2 — Manager + requests
- Approvals, team leave, correction/WFH/on-duty/comp-off, notification deep links

### Phase 3 — Workplace extras
- Documents, announcements, compliance, support, rooms, assets, profile bank/emergency/education/security

### Phase 4 — Career + unlock (current)
- Performance reviews list
- Training assignments list
- Separation / resignation request + history
- First-run onboarding carousel
- Biometric app unlock (Face ID / fingerprint) via Profile → Security & KYC
- Session gate on cold start when biometrics are enabled

## EAS (when you want an APK)

```bash
npm i -g eas-cli
eas login
eas init
eas build --profile preview --platform android
```

## Next (Phase 5+)

Store polish: icons/splash branding, EAS production profiles, crash reporting, offline queue hardening.
