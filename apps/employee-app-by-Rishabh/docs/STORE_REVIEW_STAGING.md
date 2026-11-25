# Store review staging — what to prepare (ship today)

One **staging backend** (Render) + **Neon Postgres**.  
Reviewers do **not** pick Demo/Normal mode. They use the credentials you paste into App Store Connect / Play Console.

Frontend **mock mode is NOT required** for store review when this staging API is live.

---

## 1. Credentials (2 accounts)

| Role | Email (login) | Password | Emp code |
|------|---------------|----------|----------|
| **Employee (primary)** | `review.employee@iconnectplus.in` | `Review@2026` | `REV001` |
| **Manager (optional)** | `review.manager@iconnectplus.in` | `Review@2026` | `RVM001` |

**Company code (hardcoded in app):** `CDPL0112`

Paste into review notes (copy/paste):

```text
Company is preselected in-app (CDPL0112).

Primary login:
  Email: review.employee@iconnectplus.in
  Password: Review@2026

Optional manager (Approvals / team):
  Email: review.manager@iconnectplus.in
  Password: Review@2026

Suggested path:
  1) Login → Feed (stories + posts)
  2) Attendance → Check In / Check Out (location permission OK; staging disables geofence)
  3) Leave → apply Casual Leave
  4) Profile → Privacy / data deletion links
```

---

## 2. Seed data included (`python -m scripts.seed_store_review`)

- Company `CDPL0112`, branch HQ, department OPS  
- Soft punch rule: **no geofence / selfie / face**  
- Leave types CL / SL / EL + balances (~11–14 days)  
- ~4 days of past attendance for the employee  
- Manager reports link (employee → manager)  
- `must_change_password=false`, face auth off  

API runtime flag: `ESS_STORE_REVIEW_MODE=true` (also relaxes punch gates).

---

## 3. Neon DB (created)

| Item | Value |
|------|--------|
| Project | `iconnect-ess-store-review` |
| Project id | `holy-firefly-46764792` |
| Region | `aws-ap-southeast-1` |
| Database | `neondb` |

Connection string: Neon Console → project → Connection details  
(Use **pooled** `…-pooler…` URL; for SQLAlchemy prefer  
`postgresql+psycopg://…?sslmode=require`.)

**Sleep:** Neon free compute can idle. During review week either:
- keep a 5‑min health ping (hits API → DB), or  
- upgrade Neon compute / set longer suspend if your plan allows.

---

## 4. Render API (no auto-sleep)

| Do | Don’t |
|----|--------|
| Web Service plan **Starter** (or higher) | Free web service (sleeps ~15 min) |
| Health check `/api/v1/health` | Rely on cold start during App Review |
| `ESS_STORE_REVIEW_MODE=true` | Leave geofence/selfie on for reviewers |
| After deploy: run seed | Ship empty DB |

Blueprint file: repo root `render.yaml`  
Docker: `apps/api/Dockerfile`

After first successful deploy (Render Shell):

```bash
cd /app
python -m scripts.seed_store_review
```

Verify:

```bash
curl -s https://YOUR-SERVICE.onrender.com/api/v1/health
```

Keep-alive: UptimeRobot (or Render cron) every 5 minutes → same health URL.

---

## 5. Mobile app build pointing at staging

`apps/employee-app-by-Rishabh/.env` (store / release build):

```env
EXPO_PUBLIC_API_URL=https://YOUR-SERVICE.onrender.com/api/v1
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://iconnectplus.in/legal/privacy
EXPO_PUBLIC_TERMS_URL=https://iconnectplus.in/legal/terms
EXPO_PUBLIC_DATA_DELETION_URL=https://iconnectplus.in/legal/data-deletion
```

Then EAS / Play / App Store build. **No second app.** When production API is ready, change `EXPO_PUBLIC_API_URL` and ship an update (same package id).

---

## 6. Today’s checklist

- [ ] Neon project exists (`iconnect-ess-store-review`)  
- [ ] Render **Starter** web service from `render.yaml` + `DATABASE_URL`  
- [ ] Migrations OK on boot (`RUN_MIGRATIONS=true`)  
- [ ] `python -m scripts.seed_store_review`  
- [ ] Health URL stays green (uptime ping)  
- [ ] Phone build uses staging API, `USE_MOCK=false`  
- [ ] Review notes = employee credentials above  
- [ ] Privacy / terms / deletion URLs live on iconnectplus.in  
