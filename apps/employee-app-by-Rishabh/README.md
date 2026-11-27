# Employee App by Rishabh (Expo)

React Native + Expo Router (SDK 58) app for Employee Self-Service (ESS). It is the
native counterpart of the `apps/employee-app` PWA and covers the same screens.

## Quick start

```bash
cd apps/employee-app-by-Rishabh
npm install --legacy-peer-deps
cp .env.example .env
npm run start:tunnel   # Expo Go over a tunnel (phone on any network)
npm start              # Expo Go over LAN (phone on the same Wi-Fi)
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Environment

Backend is fixed to **`https://ess-api.iconnectplus.in/api/v1`** (health: `/health`).

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_APP_NAME` | Display name |
| Legal URLs | Privacy / Terms / Data deletion / Support email |

Do not point this app at localhost, Render, or other hosts.

## HRMS connectivity

The app never talks to the HRMS directly and never holds the HRMS API key.
Admins save the HRMS base URL, employees path and API key in the web app under
**Organization → Users → HRMS API**. The ERP API uses those settings to serve:

- `GET /ess/hrms-profile` - caller's HRMS profile + leave balances (leave refreshed on every call)
- `POST /ess/hrms-profile/refresh` - force a full re-fetch from HRMS

Profile → Personal Information shows these details with a **Sync from HRMS**
button, and the Leave tab falls back to HRMS balances when the ERP has none.

## Screens

Home, attendance (punch, history, correction, WFH, on-duty, comp-off), leave
(apply, history, team, holidays), payslips (list, detail, breakdown, history,
tax), profile (personal, bank, emergency, education, security, change
password), approvals, notifications, announcements, documents, compliance,
support, meeting rooms, assets (scan/report), training, performance,
separation, timesheet, roster, onboarding, face verify, biometric lock, offline.

## EAS (when you want an APK)

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --profile preview --platform android
```
