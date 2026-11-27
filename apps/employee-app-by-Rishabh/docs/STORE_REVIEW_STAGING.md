# Store review staging — ESS API

Single backend for the employee app:

**`https://ess-api.iconnectplus.in/api/v1`**  
Health: **`https://ess-api.iconnectplus.in/api/v1/health`**

Keep-alive: ping the health URL every few minutes during App Review week.

---

## 1. Credentials (2 accounts)

| Role | Email (login) | Password | Emp code |
|------|---------------|----------|----------|
| **Employee (primary)** | `review.employee@iconnectplus.in` | `Review@2026` | `REV001` |
| **Manager (optional)** | `review.manager@iconnectplus.in` | `Review@2026` | `RVM001` |

**Company code (hardcoded in app):** `CDPL0112`

```text
Company is preselected in-app (CDPL0112).

Primary login:
  Email: review.employee@iconnectplus.in
  Password: Review@2026

Optional manager (Approvals / team):
  Email: review.manager@iconnectplus.in
  Password: Review@2026

Suggested path:
  1) Login → Feed (stories + posts). Open post ⋮ → Report / Block author
  2) Attendance → Check In / Check Out
  3) Leave → apply Casual Leave
  4) Profile → Privacy / Request account / data deletion
```

Re-seed demo content (against ess-api only):

```bash
cd apps/employee-app-by-Rishabh
python scripts/_seed_review_demo.py
python scripts/_verify_review_seed.py
```

---

## 2. Mobile app

`.env` / EAS production env must use only:

```env
EXPO_PUBLIC_API_URL=https://ess-api.iconnectplus.in/api/v1
EXPO_PUBLIC_API_URL_WEB=https://ess-api.iconnectplus.in/api/v1
EXPO_PUBLIC_USE_MOCK=false
```

---

## 3. Checklist

- [ ] `GET https://ess-api.iconnectplus.in/api/v1/health` → `200` `{"success":true,...}`
- [ ] Review login works
- [ ] Health URL stays green (uptime ping)
- [ ] Review notes credentials above
- [ ] Privacy / terms / deletion URLs live on iconnectplus.in
