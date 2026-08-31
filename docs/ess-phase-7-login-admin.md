# ESS Phase 7 — Login parity, HR policy admin, password ops

## Employee login (company + employee code)

| Endpoint | Description |
|----------|-------------|
| `GET /auth/ess/captcha` | Math CAPTCHA when `ESS_LOGIN_CAPTCHA_ENABLED=true` |
| `POST /auth/ess/login` | Body: `company_code`, `employee_code`, `password`, optional `captcha_id` / `captcha_answer` |

Resolves `OrgCompany` + `MasterEmployee` (normalized emp code, e.g. `EMP-004` → `EMP004`), then authenticates the linked `SecUser`. Account lockout uses existing `ACCOUNT_LOCKOUT_*` settings.

**PWA:** Login screen defaults to **Employee code** tab (company + emp code + password). Email login remains available.

## HR — ESS policies (web)

| Endpoint | Permission |
|----------|----------------|
| `GET/POST/PATCH /hr/ess-policies` | `hr.employee_profile:*` |
| `POST .../publish` | Bumps `policy_version` when republishing |
| `POST .../archive` | Archives policy |

**Web UI:** [HR → ESS policies](/hr/ess-policies) — create draft, edit markdown, publish.

Employees see updates via existing Phase 6 `/ess/policies` walkthrough (`pending_policy_count` increases when version bumps).

## HR — force password reset

`POST /hr/employee-profiles/force-password-reset/{employee_id}`

Sets `must_change_password=true` on the employee’s linked user (security audit `auth.force_password_change`).

**Web UI:** Workforce profile (`/hr/workforce/[employeeId]`) → **Require ESS password change**.

## Configuration

```env
ESS_LOGIN_CAPTCHA_ENABLED=false   # set true to require CAPTCHA on ESS code login
```

## Smoke test

1. `alembic upgrade head` (includes `0470` if not yet applied).
2. HR: open `/hr/ess-policies`, publish a policy.
3. PWA: sign in with `DEMOCO` / `EMP-004` / default password.
4. Optional: enable CAPTCHA env and verify login flow.
5. HR: force password reset → employee must change password on next ESS session.
