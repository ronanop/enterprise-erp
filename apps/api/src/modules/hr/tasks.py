"""HR Celery tasks."""

from workers.celery_app import celery_app


@celery_app.task(name="hr.attendance_auto_lock")
def attendance_auto_lock() -> dict:
    from datetime import date, timedelta

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrAttendance

    db = SessionLocal()
    try:
        cutoff = date.today() - timedelta(days=1)
        rows = list(
            db.scalars(
                select(HrAttendance).where(
                    HrAttendance.is_deleted.is_(False),
                    HrAttendance.status.in_(["recorded", "adjusted"]),
                    HrAttendance.attendance_date <= cutoff,
                )
            ).all()
        )
        locked = 0
        for row in rows:
            row.status = "locked"
            locked += 1
        db.commit()
        return {"status": "ok", "candidates": len(rows), "locked": locked}
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


@celery_app.task(name="hr.attendance_auto_absent")
def attendance_auto_absent() -> dict:
    """Mark active employees with no punch yesterday as absent (skip offs/leave/holiday).

    Also marks open check-in (no checkout) rows as miss_punch, and creates week_off /
    holiday attendance rows so calendars stay complete.
    """
    from datetime import date, timedelta
    from uuid import uuid4

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrAttendance, HrEmployment, HrHolidayCalendar, HrLeaveRequest
    from modules.hr.models.weekly_off_policy import HrWeeklyOffPolicy
    from modules.hr.service.engines.calendar_rules import (
        holiday_dates_from_json,
        is_weekly_off_day,
    )
    from modules.master_data.models.employee import MasterEmployee

    db = SessionLocal()
    try:
        yesterday = date.today() - timedelta(days=1)
        employments = list(
            db.scalars(
                select(HrEmployment).where(
                    HrEmployment.is_deleted.is_(False),
                    HrEmployment.status.in_(("active", "probation", "confirmed")),
                )
            ).all()
        )
        existing_rows = list(
            db.scalars(
                select(HrAttendance).where(
                    HrAttendance.is_deleted.is_(False),
                    HrAttendance.attendance_date == yesterday,
                )
            ).all()
        )
        existing = {(r.employee_id, r.attendance_date): r for r in existing_rows}

        # Fully approved leave covering yesterday
        leave_rows = list(
            db.scalars(
                select(HrLeaveRequest).where(
                    HrLeaveRequest.is_deleted.is_(False),
                    HrLeaveRequest.status == "approved",
                    HrLeaveRequest.start_date <= yesterday,
                    HrLeaveRequest.end_date >= yesterday,
                )
            ).all()
        )
        on_leave = {r.employee_id for r in leave_rows}

        calendars = list(
            db.scalars(
                select(HrHolidayCalendar).where(
                    HrHolidayCalendar.is_deleted.is_(False),
                    HrHolidayCalendar.status == "published",
                    HrHolidayCalendar.calendar_year == yesterday.year,
                )
            ).all()
        )
        holidays_by_company: dict = {}
        for cal in calendars:
            holidays_by_company.setdefault(cal.company_id, set()).update(
                holiday_dates_from_json(cal.holidays_json)
            )

        policies = list(
            db.scalars(
                select(HrWeeklyOffPolicy).where(
                    HrWeeklyOffPolicy.is_deleted.is_(False),
                    HrWeeklyOffPolicy.status == "active",
                )
            ).all()
        )
        policy_by_company: dict = {}
        for p in policies:
            cur = policy_by_company.get(p.company_id)
            if cur is None or (p.is_default and not cur.is_default):
                policy_by_company[p.company_id] = p

        created_absent = 0
        created_week_off = 0
        created_holiday = 0
        miss_punch = 0
        skipped_leave = 0

        for row in existing_rows:
            if row.check_in_at is not None and row.check_out_at is None:
                if row.attendance_status not in {"miss_punch", "holiday", "week_off", "absent"}:
                    if row.status != "locked":
                        row.attendance_status = "miss_punch"
                        marker = "auto-miss-punch: no checkout"
                        row.notes = f"{row.notes} | {marker}".strip(" |") if row.notes else marker
                        miss_punch += 1

        for emp_row in employments:
            key = (emp_row.employee_id, yesterday)
            if key in existing:
                continue
            master = db.get(MasterEmployee, emp_row.employee_id)
            if master is None or getattr(master, "is_deleted", False):
                continue
            if emp_row.employee_id in on_leave:
                skipped_leave += 1
                continue

            holidays = holidays_by_company.get(emp_row.company_id, set())
            is_holiday = yesterday in holidays
            policy = policy_by_company.get(emp_row.company_id)
            rules = policy.rules_json if policy else None
            custom = policy.custom_weekdays_json if policy else None
            alt = policy.alternate_saturday_start if policy else None
            is_off = is_weekly_off_day(
                yesterday, rules, custom_weekdays=custom, alternate_start=alt
            )

            if is_holiday:
                status = "holiday"
                notes = "auto-holiday: published calendar"
                created_holiday += 1
            elif is_off:
                status = "week_off"
                notes = "auto-week-off: weekly off policy"
                created_week_off += 1
            else:
                status = "absent"
                notes = "auto-absent: no punch"
                created_absent += 1

            row = HrAttendance(
                id=uuid4(),
                tenant_id=emp_row.tenant_id,
                company_id=emp_row.company_id,
                branch_id=emp_row.branch_id,
                employee_id=emp_row.employee_id,
                attendance_date=yesterday,
                attendance_status=status,
                source="manual",
                status="recorded",
                notes=notes,
                created_by=None,
                updated_by=None,
            )
            db.add(row)
            existing[key] = row

        db.commit()
        return {
            "status": "ok",
            "date": yesterday.isoformat(),
            "absent_created": created_absent,
            "week_off_created": created_week_off,
            "holiday_created": created_holiday,
            "miss_punch_marked": miss_punch,
            "skipped_on_leave": skipped_leave,
        }
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


@celery_app.task(name="hr.leave_balance_accrual")
def leave_balance_accrual(period_yyyymm: str | None = None) -> dict:
    """Credit monthly leave accrual for the last completed calendar month (1–31).

    When ``period_yyyymm`` is omitted, uses the month that fully ended before today
    (e.g. run on 1 Mar 2026 → ``2026-02``). Independent of payroll 20–20 cycle.
    """
    from database.session import SessionLocal
    from modules.hr.domain.leave_accrual_calendar import (
        balance_year_for_accrual_period,
        completed_calendar_month_yyyymm,
    )
    from modules.hr.service.leave_service import LeaveBalanceService

    period = period_yyyymm or completed_calendar_month_yyyymm()
    balance_year = balance_year_for_accrual_period(period)

    db = SessionLocal()
    try:
        result = LeaveBalanceService.run_monthly_accrual_all_tenants(
            db, period_yyyymm=period, balance_year=balance_year
        )
        db.commit()
        return {"status": "ok", "period_yyyymm": period, **result}
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


@celery_app.task(name="hr.leave_carry_forward_year_end")
def leave_carry_forward_year_end(from_year: int | None = None) -> dict:
    """Year-end carry-forward for CF-enabled leave types (idempotent per closed source year)."""
    from datetime import date
    from uuid import uuid4

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.foundation.domain.value_objects import TenantContext
    from modules.hr.models import HrLeaveBalance
    from modules.hr.service.leave_service import LeaveBalanceService

    db = SessionLocal()
    try:
        src = from_year or (date.today().year - 1)
        open_rows = list(
            db.scalars(
                select(HrLeaveBalance).where(
                    HrLeaveBalance.is_deleted.is_(False),
                    HrLeaveBalance.status == "open",
                    HrLeaveBalance.balance_year == src,
                )
            ).all()
        )
        companies = {(r.tenant_id, r.company_id) for r in open_rows}
        total_carried = 0
        total_closed = 0
        system_user = uuid4()
        for tenant_id, company_id in companies:
            ctx = TenantContext(
                tenant_id=tenant_id,
                user_id=system_user,
                user_type="super_admin",
                company_id=company_id,
            )
            try:
                result = LeaveBalanceService(db).carry_forward_year_end(
                    ctx, from_year=src, company_id=company_id
                )
                total_carried += int(result.get("carried") or 0)
                total_closed += int(result.get("closed") or 0)
            except Exception:
                continue
        db.commit()
        return {
            "status": "ok",
            "from_year": src,
            "carried": total_carried,
            "closed": total_closed,
            "companies": len(companies),
        }
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


@celery_app.task(name="hr.leave_reminders")
def leave_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrLeaveRequest
    from modules.hr.service.hr_notify import notify_employee

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HrLeaveRequest).where(
                    HrLeaveRequest.is_deleted.is_(False),
                    HrLeaveRequest.status.in_(("submitted", "manager_approved")),
                )
            ).all()
        )
        notified = 0
        for row in rows:
            try:
                if notify_employee(
                    db,
                    tenant_id=row.tenant_id,
                    employee_id=row.employee_id,
                    template_code="hr.leave_pending_reminder",
                    template_name="Leave Pending Approval",
                    event_type="hr.leave_pending_reminder",
                    title="Leave approval pending",
                    body=f"Leave {row.document_number} is still awaiting approval.",
                    kind="leave",
                ):
                    notified += 1
            except Exception:
                continue
        db.commit()
        return {"status": "ok", "pending_approvals": len(rows), "notifications_sent": notified}
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


@celery_app.task(name="hr.performance_review_due")
def performance_review_due() -> dict:
    from datetime import date

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrPerformanceReview

    db = SessionLocal()
    try:
        today = date.today()
        rows = list(
            db.scalars(
                select(HrPerformanceReview).where(
                    HrPerformanceReview.is_deleted.is_(False),
                    HrPerformanceReview.status.in_(["draft", "in_progress"]),
                    HrPerformanceReview.period_end <= today,
                )
            ).all()
        )
        return {"status": "ok", "due_reviews": len(rows)}
    finally:
        db.close()


@celery_app.task(name="hr.training_due_alerts")
def training_due_alerts() -> dict:
    """Find trainings scheduled for today and enrolled attendees (for notification workers)."""
    from datetime import date

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrTraining, HrTrainingAttendance

    db = SessionLocal()
    try:
        today = date.today()
        trainings = list(
            db.scalars(
                select(HrTraining).where(
                    HrTraining.is_deleted.is_(False),
                    HrTraining.status.in_(["planned", "in_progress"]),
                    HrTraining.start_date == today,
                )
            ).all()
        )
        attendee_count = 0
        for trn in trainings:
            attendee_count += len(
                list(
                    db.scalars(
                        select(HrTrainingAttendance).where(
                            HrTrainingAttendance.training_id == trn.id,
                            HrTrainingAttendance.is_deleted.is_(False),
                            HrTrainingAttendance.status == "active",
                        )
                    ).all()
                )
            )
        return {
            "status": "ok",
            "due_trainings": len(trainings),
            "attendees_to_notify": attendee_count,
            "message": "Day-of reminders ready for notification engine",
        }
    finally:
        db.close()


@celery_app.task(name="hr.separation_followups")
def separation_followups() -> dict:
    """Remind employees with open separations approaching last working day."""
    from datetime import date, timedelta

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrSeparation
    from modules.hr.service.hr_notify import notify_employee

    db = SessionLocal()
    try:
        today = date.today()
        window_end = today + timedelta(days=7)
        rows = list(
            db.scalars(
                select(HrSeparation).where(
                    HrSeparation.is_deleted.is_(False),
                    HrSeparation.status.in_(["submitted", "manager_approved", "hr_approved"]),
                )
            ).all()
        )
        notified = 0
        for row in rows:
            lwd = row.approved_last_working_date or row.requested_last_working_date
            if lwd is None or lwd < today or lwd > window_end:
                continue
            days_left = (lwd - today).days
            try:
                if notify_employee(
                    db,
                    tenant_id=row.tenant_id,
                    employee_id=row.employee_id,
                    template_code="hr.resignation_reminder",
                    template_name="Resignation Reminder",
                    event_type="hr.resignation_reminder",
                    title="Resignation follow-up",
                    body=(
                        f"Your last working day is {lwd.isoformat()} "
                        f"({days_left} day(s) remaining). Complete clearance if pending."
                    ),
                    kind="separation",
                ):
                    notified += 1
            except Exception:
                continue
        return {
            "status": "ok",
            "open_separations": len(rows),
            "reminders_sent": notified,
        }
    finally:
        db.close()


@celery_app.task(name="hr.probation_reminders")
def probation_reminders() -> dict:
    """Send probation reminders 30/15/7/0 days before end date (employee + manager + HR)."""
    from datetime import date

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.foundation.models.security import SecUser
    from modules.foundation.service.notification_service import NotificationService
    from modules.hr.models import HrEmployment
    from modules.master_data.models.employee import MasterEmployee
    from security.rbac import RBACEngine

    def _hr_recipients(db, tenant_id, company_id) -> list[tuple]:
        """Users with hr.employment:confirm, else employees whose designation looks like HR."""
        out: list[tuple] = []
        seen: set = set()
        user_ids = RBACEngine(db).list_user_ids_with_permission(
            tenant_id, "hr.employment:confirm"
        )
        for uid in user_ids:
            user = db.get(SecUser, uid)
            if user is None or getattr(user, "is_deleted", False):
                continue
            if user.status != "active":
                continue
            key = user.id
            if key in seen:
                continue
            seen.add(key)
            out.append((user.id, user.email))
        if out:
            return out
        # Fallback: designation contains HR
        for emp in db.scalars(
            select(MasterEmployee).where(
                MasterEmployee.company_id == company_id,
                MasterEmployee.is_deleted.is_(False),
                MasterEmployee.user_id.is_not(None),
                MasterEmployee.designation.ilike("%HR%"),
            )
        ).all():
            if emp.user_id in seen:
                continue
            seen.add(emp.user_id)
            out.append((emp.user_id, emp.email))
        return out

    db = SessionLocal()
    try:
        today = date.today()
        # V2: Day 85 / Day 170 from start; 10 days before end (~6 months); keep 30/15/7/0
        days_left_targets = {30, 15, 10, 7, 0}
        day85_hits = 0
        day170_hits = 0
        targets = {30: 0, 15: 0, 10: 0, 7: 0, 0: 0}
        sent = 0
        hr_sent = 0
        rows = list(
            db.scalars(
                select(HrEmployment).where(
                    HrEmployment.is_deleted.is_(False),
                    HrEmployment.status == "probation",
                    HrEmployment.probation_end_date.is_not(None),
                )
            ).all()
        )
        notif = NotificationService(db)
        emp_cache: dict = {}
        hr_cache: dict = {}

        def _emp(eid):
            if eid not in emp_cache:
                emp_cache[eid] = db.get(MasterEmployee, eid)
            return emp_cache[eid]

        def _hr_for(tenant_id, company_id):
            key = (tenant_id, company_id)
            if key not in hr_cache:
                hr_cache[key] = _hr_recipients(db, tenant_id, company_id)
            return hr_cache[key]

        def _send_all(row, employee, title, body, days_left=None, day_from_start=None):
            nonlocal sent, hr_sent
            tpl = notif.get_or_create_template(
                tenant_id=row.tenant_id,
                template_code="hr.probation_reminder",
                template_name="Probation Reminder",
                channel="in_app",
                subject_template="Probation ending soon",
                body_template="Your probation ends in {{days_left}} day(s) on {{end_date}}.",
            )
            payload = {
                "title": title,
                "body": body,
                "kind": "probation",
                "days_left": days_left,
                "day_from_start": day_from_start,
                "end_date": row.probation_end_date.isoformat() if row.probation_end_date else None,
                "employee_id": str(employee.id),
            }
            recipients: list[tuple] = [(employee.user_id, employee.email)]
            if employee.reporting_manager_id:
                manager = _emp(employee.reporting_manager_id)
                if manager is not None:
                    recipients.append((manager.user_id, manager.email))
            hr_list = _hr_for(row.tenant_id, row.company_id)
            recipients.extend(hr_list)
            seen_ids: set = set()
            for user_id, address in recipients:
                dedupe = user_id or address
                if dedupe in seen_ids:
                    continue
                seen_ids.add(dedupe)
                notif.send(
                    tenant_id=row.tenant_id,
                    template_id=tpl.id,
                    event_type="hr.probation_reminder",
                    recipient_user_id=user_id,
                    recipient_address=address,
                    payload_json=payload,
                )
                sent += 1
                if any(user_id == h[0] for h in hr_list if user_id):
                    hr_sent += 1

        for row in rows:
            employee = _emp(row.employee_id)
            if employee is None:
                continue

            # Day 85 / Day 170 checkpoints from probation start
            if row.probation_start_date is not None:
                day_from_start = (today - row.probation_start_date).days
                if day_from_start == 85:
                    day85_hits += 1
                    _send_all(
                        row,
                        employee,
                        title="Probation Day 85 checkpoint",
                        body=(
                            f"Probation Day 85 for {employee.first_name} {employee.last_name} "
                            f"({employee.employee_code}). Review progress with manager/HR."
                        ),
                        day_from_start=85,
                    )
                if day_from_start == 170:
                    day170_hits += 1
                    _send_all(
                        row,
                        employee,
                        title="Probation Day 170 checkpoint",
                        body=(
                            f"Probation Day 170 for {employee.first_name} {employee.last_name} "
                            f"({employee.employee_code}). Prepare confirmation / extension decision."
                        ),
                        day_from_start=170,
                    )

            days_left = (row.probation_end_date - today).days
            if days_left not in days_left_targets:
                continue
            targets[days_left] += 1
            title = (
                "Probation ends today"
                if days_left == 0
                else f"Probation ends in {days_left} day(s)"
            )
            body = (
                f"Probation for {employee.first_name} {employee.last_name} "
                f"({employee.employee_code}) ends on {row.probation_end_date.isoformat()}."
            )
            _send_all(row, employee, title=title, body=body, days_left=days_left)
        db.commit()
        return {
            "status": "ok",
            "due_in_30": targets[30],
            "due_in_15": targets[15],
            "due_in_10": targets[10],
            "due_in_7": targets[7],
            "due_today": targets[0],
            "day_85": day85_hits,
            "day_170": day170_hits,
            "notifications_sent": sent,
            "hr_recipient_sends": hr_sent,
        }
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


@celery_app.task(name="hr.leave_balance_monthly_credit")
def leave_balance_monthly_credit(period_yyyymm: str | None = None) -> dict:
    """Idempotent monthly leave credit (calendar month) + employee notifications."""
    from decimal import Decimal

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.foundation.service.notification_service import NotificationService
    from modules.hr.domain.leave_accrual_calendar import (
        balance_year_for_accrual_period,
        completed_calendar_month_yyyymm,
    )
    from modules.hr.models import HrLeaveBalance, HrLeaveType
    from modules.hr.service.leave_service import LeaveBalanceService
    from modules.master_data.models.employee import MasterEmployee

    period = period_yyyymm or completed_calendar_month_yyyymm()
    balance_year = balance_year_for_accrual_period(period)

    db = SessionLocal()
    try:
        accrual = LeaveBalanceService.run_monthly_accrual_all_tenants(
            db, period_yyyymm=period, balance_year=balance_year
        )
        types = {
            t.id: t
            for t in db.scalars(
                select(HrLeaveType).where(
                    HrLeaveType.is_deleted.is_(False),
                    HrLeaveType.status == "active",
                    HrLeaveType.monthly_credit_days.is_not(None),
                )
            ).all()
        }
        balances = list(
            db.scalars(
                select(HrLeaveBalance).where(
                    HrLeaveBalance.is_deleted.is_(False),
                    HrLeaveBalance.status == "open",
                    HrLeaveBalance.balance_year == balance_year,
                    HrLeaveBalance.last_accrual_yyyymm == period,
                )
            ).all()
        )
        notif = NotificationService(db)
        notified = 0
        for bal in balances:
            lt = types.get(bal.leave_type_id)
            if lt is None or not lt.monthly_credit_days:
                continue
            credit = Decimal(str(lt.monthly_credit_days))
            employee = db.get(MasterEmployee, bal.employee_id)
            if employee is None or not employee.user_id:
                continue
            tpl = notif.get_or_create_template(
                tenant_id=bal.tenant_id,
                template_code="hr.leave_monthly_credit",
                template_name="Leave Monthly Credit",
                channel="in_app",
                subject_template="Leave balance credited",
                body_template="{{days}} day(s) credited to {{leave_type}}.",
            )
            notif.send(
                tenant_id=bal.tenant_id,
                template_id=tpl.id,
                event_type="hr.leave_monthly_credit",
                recipient_user_id=employee.user_id,
                recipient_address=employee.email,
                payload_json={
                    "title": "Leave balance credited",
                    "body": f"{credit} day(s) credited to {lt.leave_type_name}.",
                    "kind": "leave",
                    "leave_type": lt.leave_type_name,
                    "days": str(credit),
                },
            )
            notified += 1
        db.commit()
        return {
            "status": "ok",
            "period_yyyymm": period,
            "notifications_sent": notified,
            **accrual,
        }
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


def _notify_upcoming_birthday_digests(db, today) -> int:
    """Notify HR users about birthdays in the next 30 days (one digest per user per day)."""
    from sqlalchemy import select

    from modules.foundation.models.security import SecUser
    from modules.foundation.service.notification_service import NotificationService
    from modules.hr.models import HrEmployeeProfile
    from modules.hr.service.birthday_window import is_upcoming_birthday
    from modules.hr.service.hr_notify import _send_in_app
    from security.rbac import RBACEngine

    profiles = list(
        db.scalars(
            select(HrEmployeeProfile).where(
                HrEmployeeProfile.is_deleted.is_(False),
                HrEmployeeProfile.date_of_birth.is_not(None),
            )
        ).all()
    )
    counts: dict = {}
    for profile in profiles:
        if is_upcoming_birthday(profile.date_of_birth, today, days=30):
            counts[profile.tenant_id] = counts.get(profile.tenant_id, 0) + 1

    sent = 0
    digest_key = f"upcoming_birthdays:{today.isoformat()}"
    notif = NotificationService(db)
    rbac = RBACEngine(db)
    for tenant_id, count in counts.items():
        if count <= 0:
            continue
        for uid in rbac.list_user_ids_with_permission(tenant_id, "hr.employee_profile:update"):
            existing = notif.find_unread_digest(
                tenant_id=tenant_id,
                user_id=uid,
                event_type="hr.upcoming_birthdays",
                digest_key=digest_key,
            )
            if existing is not None:
                continue
            user = db.get(SecUser, uid)
            if user is None or getattr(user, "is_deleted", False) or user.status != "active":
                continue
            if _send_in_app(
                db,
                tenant_id=tenant_id,
                recipient_user_id=user.id,
                recipient_address=user.email,
                template_code="hr.upcoming_birthdays",
                template_name="Upcoming Birthdays",
                event_type="hr.upcoming_birthdays",
                title="Upcoming Birthdays",
                body=f"{count} birthday(s) in the next 30 days.",
                kind="birthday",
                extra={"href": "/hr", "digest_key": digest_key},
            ):
                sent += 1
    return sent


@celery_app.task(name="hr.birthday_anniversary_reminders")
def birthday_anniversary_reminders() -> dict:
    """Daily in-app birthday + work-anniversary notifications."""
    from datetime import date

    from sqlalchemy import extract, select

    from database.session import SessionLocal
    from modules.hr.models import HrEmployeeProfile
    from modules.hr.service.hr_notify import notify_employee
    from modules.master_data.models.employee import MasterEmployee

    db = SessionLocal()
    try:
        today = date.today()
        profiles = list(
            db.scalars(
                select(HrEmployeeProfile).where(
                    HrEmployeeProfile.is_deleted.is_(False),
                    HrEmployeeProfile.date_of_birth.is_not(None),
                    extract("month", HrEmployeeProfile.date_of_birth) == today.month,
                    extract("day", HrEmployeeProfile.date_of_birth) == today.day,
                )
            ).all()
        )
        birthdays = 0
        for profile in profiles:
            try:
                if notify_employee(
                    db,
                    tenant_id=profile.tenant_id,
                    employee_id=profile.employee_id,
                    template_code="hr.birthday",
                    template_name="Birthday Wish",
                    event_type="hr.birthday",
                    title="Happy Birthday!",
                    body="Wishing you a wonderful birthday from the HR team.",
                    kind="birthday",
                    extra={"href": "/hr/ess"},
                    cc_reporting_manager=False,
                ):
                    birthdays += 1
            except Exception:
                continue

        employees = list(
            db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.is_deleted.is_(False),
                    extract("month", MasterEmployee.date_of_joining) == today.month,
                    extract("day", MasterEmployee.date_of_joining) == today.day,
                )
            ).all()
        )
        anniversaries = 0
        for emp in employees:
            years = today.year - emp.date_of_joining.year
            if years <= 0:
                continue
            try:
                if notify_employee(
                    db,
                    tenant_id=emp.tenant_id,
                    employee_id=emp.id,
                    template_code="hr.work_anniversary",
                    template_name="Work Anniversary",
                    event_type="hr.work_anniversary",
                    title="Happy Work Anniversary!",
                    body=f"Congratulations on {years} year(s) with us.",
                    kind="anniversary",
                    extra={"years": years},
                ):
                    anniversaries += 1
            except Exception:
                continue

        hr_digests = _notify_upcoming_birthday_digests(db, today)
        db.commit()
        return {
            "status": "ok",
            "birthdays": birthdays,
            "anniversaries": anniversaries,
            "hr_digests": hr_digests,
        }
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


@celery_app.task(name="hr.holiday_reminders")
def holiday_reminders() -> dict:
    """Notify employees about holidays falling today (published calendars)."""
    from datetime import date

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.foundation.service.notification_service import NotificationService
    from modules.hr.models import HrHolidayCalendar
    from modules.master_data.models.employee import MasterEmployee

    db = SessionLocal()
    try:
        today = date.today()
        calendars = list(
            db.scalars(
                select(HrHolidayCalendar).where(
                    HrHolidayCalendar.is_deleted.is_(False),
                    HrHolidayCalendar.status == "published",
                )
            ).all()
        )
        holiday_names: list[str] = []
        for cal in calendars:
            holidays = cal.holidays_json or []
            if isinstance(holidays, dict):
                holidays = holidays.get("days") or holidays.get("holidays") or []
            if not isinstance(holidays, list):
                continue
            for item in holidays:
                if isinstance(item, dict):
                    raw = item.get("date") or item.get("holiday_date")
                    try:
                        hdate = date.fromisoformat(str(raw)[:10]) if raw else None
                    except ValueError:
                        hdate = None
                    if hdate == today:
                        holiday_names.append(str(item.get("name") or item.get("title") or "Holiday"))
        if not holiday_names:
            return {"status": "ok", "holidays": 0, "notifications_sent": 0}

        title = f"Today is a holiday: {', '.join(holiday_names[:3])}"
        body = "Enjoy your holiday. Office will be closed / marked as holiday."
        employees = list(
            db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.is_deleted.is_(False),
                    MasterEmployee.status.in_(("active", "probation", "confirmed")),
                    MasterEmployee.user_id.is_not(None),
                )
            ).all()
        )
        notif = NotificationService(db)
        notified = 0
        for emp in employees:
            try:
                tpl = notif.get_or_create_template(
                    tenant_id=emp.tenant_id,
                    template_code="hr.holiday",
                    template_name="Holiday Reminder",
                    channel="in_app",
                    subject_template=title,
                    body_template=body,
                )
                notif.send(
                    tenant_id=emp.tenant_id,
                    template_id=tpl.id,
                    event_type="hr.holiday",
                    recipient_user_id=emp.user_id,
                    recipient_address=emp.email,
                    payload_json={"title": title, "body": body, "kind": "holiday"},
                )
                notified += 1
            except Exception:
                continue
        db.commit()
        return {"status": "ok", "holidays": len(holiday_names), "notifications_sent": notified}
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()
