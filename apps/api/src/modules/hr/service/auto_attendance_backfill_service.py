"""Backfill attendance through today for auto-attendance employment groups."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.domain.auto_attendance_plan import plan_auto_attendance_days
from modules.hr.service.engines.calendar_rules import holiday_dates_from_json, is_weekly_off_day
from modules.hr.models import HrAttendance, HrHolidayCalendar, HrLeaveRequest
from modules.hr.models.employment import HrEmployment
from modules.hr.models.weekly_off_policy import HrWeeklyOffPolicy
from modules.hr.repository.attendance_repository import AttendanceRepository

_APPROVED_LEAVE = frozenset({"approved", "manager_approved"})
_MAX_DAYS = 400


class AutoAttendanceBackfillService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._attendance = AttendanceRepository(db)

    def backfill_employment(self, ctx: TenantContext, employment: HrEmployment) -> int:
        today = date.today()
        start = employment.date_of_joining or today
        if start > today:
            return 0
        span = (today - start).days + 1
        if span > _MAX_DAYS:
            start = today - timedelta(days=_MAX_DAYS - 1)

        holidays = self._holidays(employment.company_id, start.year, today.year)
        is_off = self._weekly_off_fn(employment.company_id)
        leave_dates = self._leave_dates(employment.employee_id, start, today)
        existing = self._existing_dates(employment.employee_id, start, today)

        planned = plan_auto_attendance_days(
            start,
            today,
            holidays=holidays,
            is_weekly_off=is_off,
            leave_dates=leave_dates,
            existing_dates=existing,
        )
        created = 0
        for day, status in planned:
            note = {
                "present": "auto-present: employment group",
                "week_off": "auto-week-off: employment group",
                "holiday": "auto-holiday: employment group",
            }.get(status, "auto-attendance: employment group")
            try:
                with self._db.begin_nested():
                    self._attendance.create(
                        ctx,
                        company_id=employment.company_id,
                        branch_id=employment.branch_id,
                        employee_id=employment.employee_id,
                        attendance_date=day,
                        attendance_status=status,
                        source="web",
                        status="recorded",
                        shift_id=None,
                        notes=note,
                    )
                created += 1
            except IntegrityError:
                continue
        return created

    def _holidays(self, company_id: UUID, year_from: int, year_to: int) -> set[date]:
        rows = list(
            self._db.scalars(
                select(HrHolidayCalendar).where(
                    HrHolidayCalendar.is_deleted.is_(False),
                    HrHolidayCalendar.company_id == company_id,
                    HrHolidayCalendar.status == "published",
                    HrHolidayCalendar.calendar_year >= year_from,
                    HrHolidayCalendar.calendar_year <= year_to,
                )
            ).all()
        )
        out: set[date] = set()
        for cal in rows:
            out.update(holiday_dates_from_json(cal.holidays_json))
        return out

    def _weekly_off_fn(self, company_id: UUID):
        policies = list(
            self._db.scalars(
                select(HrWeeklyOffPolicy).where(
                    HrWeeklyOffPolicy.is_deleted.is_(False),
                    HrWeeklyOffPolicy.company_id == company_id,
                    HrWeeklyOffPolicy.status == "active",
                )
            ).all()
        )
        policy = None
        for p in policies:
            if policy is None or (p.is_default and not policy.is_default):
                policy = p
        rules = policy.rules_json if policy else None
        custom = policy.custom_weekdays_json if policy else None
        alt = policy.alternate_saturday_start if policy else None

        def is_off(day: date) -> bool:
            return is_weekly_off_day(day, rules, custom_weekdays=custom, alternate_start=alt)

        return is_off

    def _leave_dates(self, employee_id: UUID, start: date, end: date) -> set[date]:
        rows = list(
            self._db.scalars(
                select(HrLeaveRequest).where(
                    HrLeaveRequest.is_deleted.is_(False),
                    HrLeaveRequest.employee_id == employee_id,
                    HrLeaveRequest.status.in_(_APPROVED_LEAVE),
                    HrLeaveRequest.start_date <= end,
                    HrLeaveRequest.end_date >= start,
                )
            ).all()
        )
        out: set[date] = set()
        for req in rows:
            cur = req.start_date
            while cur <= req.end_date:
                if start <= cur <= end:
                    out.add(cur)
                cur += timedelta(days=1)
        return out

    def _existing_dates(self, employee_id: UUID, start: date, end: date) -> set[date]:
        rows = list(
            self._db.scalars(
                select(HrAttendance.attendance_date).where(
                    HrAttendance.is_deleted.is_(False),
                    HrAttendance.employee_id == employee_id,
                    HrAttendance.attendance_date >= start,
                    HrAttendance.attendance_date <= end,
                )
            ).all()
        )
        return set(rows)
