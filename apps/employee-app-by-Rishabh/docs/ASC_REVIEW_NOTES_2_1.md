# App Store Connect — Review Notes (Guideline 2.1 reply)

Paste the block below into **App Review Information → Notes**, then attach a **physical-device screen recording** (required by Apple item 1) and resubmit.

Also fill **Sign-in required** credentials in ASC (same as Primary login below).

---

## Copy/paste — Notes field

```text
iConnect+ (Employee Portal) — App Review notes (Guideline 2.1)

────────────────────────────────────────
1) SCREEN RECORDING
────────────────────────────────────────
A screen recording captured on a physical iPhone (latest iOS) is attached / uploaded with this submission (or provided via the review attachment / shared link in this Notes field).

Recording flow (begins at cold launch):
  • Launch app → Login (API: https://ess-api.iconnectplus.in/api/v1 — health /health)
  • Sign in with the primary demo account below
  • Feed tab: workplace posts / stories (UGC). Open ⋮ post menu → Report, Block author, and/or Complain
  • Attendance: Check In → Check Out (location permission may be requested; staging relaxes geofence/selfie)
  • Hub → Leave: view balances → apply Casual Leave on a weekday
  • Tasks: view / create a task (optional)
  • Profile: Privacy Policy, Terms, Request account / data deletion
Account registration: NOT available in-app. Accounts are employer-provisioned by HR (B2B workplace ESS). No public sign-up.
Account deletion: Profile → “Request account / data deletion” (in-app email + web form https://iconnectplus.in/legal/data-deletion)
UGC safety: Feed post menu includes Report (flag for admin) and Block author (hides that person's posts/stories on-device).
Paid content / IAP: NONE. No subscriptions, no in-app purchases, no paid unlocks.


────────────────────────────────────────
2) PURPOSE & TARGET AUDIENCE
────────────────────────────────────────
Purpose: Mobile Employee Self-Service (ESS) for organizations using iConnect Plus HRMS/ERP.
Target audience: Employees and managers of businesses that license iConnect Plus (not a consumer social app).
Problem solved: Employees need one place on mobile for attendance punch, leave, workplace feed, tasks, payslips/documents, and profile/compliance actions without using the full desktop ERP.
Value: Faster day-to-day HR actions (punch, leave, approvals path for managers), workplace communication (feed/stories), and clear privacy/deletion paths.


────────────────────────────────────────
3) SETUP & ACCESS — LOGIN CREDENTIALS
────────────────────────────────────────
Company code is preselected in the app: CDPL0112

PRIMARY (employee — use this for review):
  Email:    review.employee@iconnectplus.in
  Password: Review@2026
  Emp code: REV001 (Asha Verma)

OPTIONAL (manager — team approvals):
  Email:    review.manager@iconnectplus.in
  Password: Review@2026
  Emp code: RVM001 (Rohan Mehta)

Suggested path:
  1) Login → Feed
  2) Attendance → Check In / Check Out
  3) Hub → Leave → apply Casual Leave (use a weekday; weekends have no working days)
  4) Profile → Privacy / Terms / Request account or data deletion

No sample files are required. Staging API is pre-seeded for these accounts.
Network: app requires internet to reach the ESS API.


────────────────────────────────────────
4) EXTERNAL SERVICES / PLATFORMS
────────────────────────────────────────
Core functionality depends on:
  • iConnect Plus ESS API — https://ess-api.iconnectplus.in/api/v1 (health: /health) — auth, attendance, leave, feed, tasks, profile
  • Apple Push Notification service (APNs) — optional push notifications when permitted
  • Device location (Core Location) — attendance punch geolocation when policy requires it
  • Device camera — optional selfie / face / document capture when policy requires it
  • Hosted legal pages on iconnectplus.in — Privacy, Terms, Data deletion

Not used: third-party consumer auth (no Sign in with Apple/Google required for demo), no payment processors, no advertising SDKs, no on-device generative AI required for core ESS flows.


────────────────────────────────────────
5) REGIONAL DIFFERENCES
────────────────────────────────────────
The app functions consistently across regions for the same employer tenant.
Content (leave types, holidays, pay) is employer/tenant-configured, not geo-locked by App Store country.
Demo tenant uses India-oriented sample HR data (e.g. leave types CL/SL/EL, INR display where pay appears) for review; production tenants configure their own locale/rules.


────────────────────────────────────────
6) REGULATED INDUSTRY / PROTECTED MATERIAL
────────────────────────────────────────
This is a B2B workplace HR / ESS client for employer-provisioned employees.
It is not a consumer banking, medical-device, or gambling product.
Employment/HR personal data is processed for the employer’s legitimate HR operations under the employer’s policies; see Privacy Policy: https://iconnectplus.in/legal/privacy
No protected third-party media catalog is redistributed. UGC is limited to workplace feed/stories within the employer tenant; Report, Block author, and Complain are available via the post ⋮ menu. Account/content removal requests go through HR via the in-app deletion request + https://iconnectplus.in/legal/data-deletion

Support: erp@iconnectplus.in
```

---

## You still must do (Apple will block without this)

1. **Physical-device screen recording** covering launch → login → feed → attendance → leave → profile/deletion (see section 1). Upload in ASC or host a private link and paste the URL at the top of Notes.
2. Confirm **Sign-in required** demo account fields in ASC match Primary login.
3. Confirm Privacy / Terms / Data deletion URLs open in Safari.
4. Re-test the submitted build on a real iPhone (TestFlight) before resubmit — especially Attendance punch and Leave apply.

## Do not use

Outdated demo login from older drafts (`demo@company.com` / `demo123`) — use `review.employee@…` / `Review@2026` only.
