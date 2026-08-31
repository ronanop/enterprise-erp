# ESS Phase 6 — Compliance & polish

Phase 6 adds mandatory policy walkthroughs, forced password change for provisioned accounts, and clearer admin guidance in the PWA.

## Database (migration `0470_ess_phase6_compliance`)

| Change | Purpose |
|--------|---------|
| `foundation.sec_user.must_change_password` | Force password update on next ESS login |
| `hr.hr_ess_policy` | Published policies (markdown, version, mandatory flag) |
| `hr.hr_ess_policy_ack` | Per-employee acknowledgment per policy version |

Run: `alembic upgrade head`

## API

### `/ess/me` (extended)

- `must_change_password`
- `pending_policy_count`
- `is_ess_admin` / `admin_use_web_portal` — admins are directed to HRMS web for full admin work

### Policies

| Endpoint | Description |
|----------|-------------|
| `GET /ess/policies` | Mandatory published policies + ack status |
| `GET /ess/policies/{id}` | Walkthrough steps (`##` headings split content) |
| `POST /ess/policies/{id}/acknowledge` | Record ack for current `policy_version` |

### Password

| Endpoint | Description |
|----------|-------------|
| `POST /ess/security/change-password` | Current + new password; clears `must_change_password`; security audit event |

## PWA flow

1. **ComplianceGuard** (app shell): if `must_change_password` → `/profile/change-password`; else if pending policies → `/compliance`.
2. **Policy hub** `/compliance` → step-through `/compliance/[id]` with checkbox on last step.
3. **Profile** — admin banner; links to policies and change password.

## Seeds

```bash
python -m scripts.seed_ess_policies
python -m scripts.seed_ess_employee   # sets must_change_password=true on demo user
```

## Smoke test

1. Migrate + seed policies + re-seed employee.
2. Log in as `employee@example.com` → forced change password → policy list → complete walkthroughs → home unlocks.
3. Optional: assign `TENANT_ADMIN` and confirm admin banner on profile (full admin still on web).

## Roadmap

Phases 1–6 of the Timelabs-style ESS backlog are now covered in code. Further items (emp-code login field, captcha, native apps) are out of scope unless added as a new phase.
