# ESS PWA — Phase 1 (Foundation)

## Delivered

1. **Default password** — `build_ess_default_password(employee_code, date_of_birth)` → `{Code}@{DDMMYYYY}` (e.g. `Emp004@07051994`; see `apps/api/src/security/ess_default_password.py`). Applied in `seed_ess_employee` when HR profile has DOB.
2. **Cancel leave** — `POST /api/v1/ess/leave-requests/{id}/cancel` (not allowed after HR approval). PWA leave detail screen wired.
3. **Monthly leave accrual** — Celery task `hr.leave_balance_accrual` credits `monthly_credit_days` per open balance (idempotent via `hr_leave_balance.last_accrual_yyyymm`). HR approval still deducts `used` on final approve.
4. **RBAC baseline** — `/ess/me` returns `role_codes`, `ess_role` (`employee` | `manager` | `admin`), `is_manager`, `can_approve_team_leave`. PWA hides Team leave link and guards `/leave/team`.

## Ops

```bash
cd apps/api
alembic upgrade head   # 0468_hr_leave_accrual_period
python -m scripts.seed_ess_employee

# Manual accrual (optional)
celery -A workers.celery_app call hr.leave_balance_accrual --kwargs='{"period_yyyymm": "2026-08"}'
```

Schedule `hr.leave_balance_accrual` on the 1st of each month via Celery Beat.
