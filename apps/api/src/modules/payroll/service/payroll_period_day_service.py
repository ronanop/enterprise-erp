"""Shift-aware payroll period day ledger (denominator N and summaries)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.domain.enums import HolidayCalendarStatus
from modules.hr.repository.employment_repository import EmploymentRepository
from modules.hr.repository.holiday_calendar_repository import HolidayCalendarRepository
from modules.hr.repository.management_group_repository import ManagementGroupRepository
from modules.hr.repository.roster_entry_repository import RosterEntryRepository
from modules.hr.repository.shift_assignment_repository import ShiftAssignmentRepository
from modules.hr.repository.weekly_off_policy_repository import WeeklyOffPolicyRepository
from modules.hr.service.engines.calendar_rules import holiday_dates_from_json, is_weekly_off_day
from modules.payroll.domain.enums import PayrollPeriodDayDenominator
from modules.payroll.domain.payroll_day_ledger import (
    calendar_days_in_period,
    expand_leave_markers,
    is_scheduled_working_day,
    iter_dates_inclusive,
    resolve_lop_on_scheduled_days,
    scheduled_working_dates,
)
from modules.payroll.domain.payroll_policy_spec import merge_attendance_rules
from modules.payroll.service.payroll_policy_service import PayrollPolicyService


@dataclass
class EmployeePayDaysResult:
    period_days: Decimal
    paid_days: Decimal
    lop_days: Decimal
    leave_days: Decimal
    has_attendance: bool
    overtime_minutes: int
    primary_shift_id: UUID | None
    day_summary_json: dict


@dataclass
class _PeriodCalendarCache:
    company_id: UUID
    period_start: date
    period_end: date
    denominator: str
    attendance_rules: dict
    roster_by_emp_date: dict[tuple[UUID, date], tuple[UUID, str]] = field(default_factory=dict)
    shift_assignments_by_emp: dict[UUID, list] = field(default_factory=dict)
    employment_by_emp: dict[UUID, object] = field(default_factory=dict)
    mgmt_by_id: dict[UUID, object] = field(default_factory=dict)
    weekly_off_by_id: dict[UUID, object] = field(default_factory=dict)
    company_weekly_off: object | None = None
    holidays_by_calendar: dict[UUID, set[date]] = field(default_factory=dict)
    company_holiday_dates: set[date] = field(default_factory=set)


class PayrollPeriodDayService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._employment = EmploymentRepository(db)
        self._roster = RosterEntryRepository(db)
        self._shift_assign = ShiftAssignmentRepository(db)
        self._mgmt = ManagementGroupRepository(db)
        self._weekly_off = WeeklyOffPolicyRepository(db)
        self._holiday_cal = HolidayCalendarRepository(db)
        self._policy = PayrollPolicyService(db)

    def build_cache(
        self,
        ctx: TenantContext,
        company_id: UUID,
        period_start: date,
        period_end: date,
    ) -> _PeriodCalendarCache:
        resolved = self._policy.get_active_or_defaults(ctx, company_id)
        denominator = str(
            resolved.get("period_day_denominator")
            or PayrollPeriodDayDenominator.SHIFT_SCHEDULED_DAYS.value
        )
        rules = merge_attendance_rules(resolved.get("attendance_rules_json"))

        cache = _PeriodCalendarCache(
            company_id=company_id,
            period_start=period_start,
            period_end=period_end,
            denominator=denominator,
            attendance_rules=rules,
        )

        for emp in self._employment.list_rows(ctx, company_id):
            cache.employment_by_emp[emp.employee_id] = emp

        for mg in self._mgmt.list_rows(ctx, company_id):
            cache.mgmt_by_id[mg.id] = mg

        cache.company_weekly_off = self._weekly_off.get_default(ctx, company_id)
        for policy in self._weekly_off.list_rows(ctx, company_id):
            cache.weekly_off_by_id[policy.id] = policy

        years = {period_start.year, period_end.year}
        for cal in self._holiday_cal.list_rows(ctx, company_id):
            if cal.status != HolidayCalendarStatus.PUBLISHED.value:
                continue
            dates = holiday_dates_from_json(cal.holidays_json)
            cache.holidays_by_calendar[cal.id] = dates
            if int(cal.calendar_year or 0) in years:
                cache.company_holiday_dates |= dates

        for row in self._roster.list_rows(ctx, company_id):
            if row.roster_date < period_start or row.roster_date > period_end:
                continue
            cache.roster_by_emp_date[(row.employee_id, row.roster_date)] = (
                row.shift_id,
                row.status,
            )

        for row in self._shift_assign.list_rows(ctx, company_id):
            if row.status not in {"approved", "active"}:
                continue
            cache.shift_assignments_by_emp.setdefault(row.employee_id, []).append(row)

        return cache

    def _weekly_off_policy(self, cache: _PeriodCalendarCache, employee_id: UUID):
        emp = cache.employment_by_emp.get(employee_id)
        if emp and emp.management_group_id:
            mg = cache.mgmt_by_id.get(emp.management_group_id)
            if mg and mg.default_weekly_off_policy_id:
                return cache.weekly_off_by_id.get(mg.default_weekly_off_policy_id)
        return cache.company_weekly_off

    def _holiday_set(self, cache: _PeriodCalendarCache, employee_id: UUID) -> set[date]:
        out = set(cache.company_holiday_dates)
        emp = cache.employment_by_emp.get(employee_id)
        if emp and emp.management_group_id:
            mg = cache.mgmt_by_id.get(emp.management_group_id)
            if mg and mg.default_holiday_calendar_id:
                out |= cache.holidays_by_calendar.get(mg.default_holiday_calendar_id, set())
        return out

    def _resolve_shift_id(
        self,
        cache: _PeriodCalendarCache,
        employee_id: UUID,
        on_date: date,
    ) -> UUID | None:
        roster = cache.roster_by_emp_date.get((employee_id, on_date))
        if roster and roster[1] == "published":
            return roster[0]

        for assignment in cache.shift_assignments_by_emp.get(employee_id, []):
            if assignment.effective_from <= on_date and (
                assignment.effective_to is None or assignment.effective_to >= on_date
            ):
                return assignment.shift_id

        emp = cache.employment_by_emp.get(employee_id)
        if emp and emp.management_group_id:
            mg = cache.mgmt_by_id.get(emp.management_group_id)
            if mg:
                return mg.default_shift_id
        return None

    def _is_week_off(self, cache: _PeriodCalendarCache, employee_id: UUID, on_date: date) -> bool:
        policy = self._weekly_off_policy(cache, employee_id)
        if policy is None:
            return is_weekly_off_day(on_date, None)
        return is_weekly_off_day(
            on_date,
            policy.rules_json,
            custom_weekdays=policy.custom_weekdays_json,
            alternate_start=policy.alternate_saturday_start,
        )

    def _is_day_scheduled(
        self,
        cache: _PeriodCalendarCache,
        employee_id: UUID,
        on_date: date,
    ) -> bool:
        holidays = self._holiday_set(cache, employee_id)
        roster = cache.roster_by_emp_date.get((employee_id, on_date))
        roster_shift = str(roster[0]) if roster else None
        roster_status = roster[1] if roster else None
        return is_scheduled_working_day(
            on_date=on_date,
            is_holiday=on_date in holidays,
            is_week_off=self._is_week_off(cache, employee_id, on_date),
            roster_shift_id=roster_shift,
            roster_status=roster_status,
        )

    def _scheduled_dates(self, cache: _PeriodCalendarCache, employee_id: UUID) -> list[date]:
        return scheduled_working_dates(
            cache.period_start,
            cache.period_end,
            is_scheduled_fn=lambda d: self._is_day_scheduled(cache, employee_id, d),
        )

    def period_denominator(self, cache: _PeriodCalendarCache, employee_id: UUID) -> Decimal:
        start, end = cache.period_start, cache.period_end
        mode = cache.denominator
        if mode == PayrollPeriodDayDenominator.FIXED_30.value:
            return Decimal("30")
        if mode == PayrollPeriodDayDenominator.ALL_CALENDAR_DAYS_IN_PERIOD.value:
            return Decimal(str(calendar_days_in_period(start, end)))

        scheduled = len(self._scheduled_dates(cache, employee_id))
        return Decimal(str(max(scheduled, 1)))

    def build_day_summary(
        self,
        cache: _PeriodCalendarCache,
        employee_id: UUID,
        attendance_in_period: list[dict],
        *,
        leave_by_date: dict | None = None,
        paid_leave_days: Decimal | None = None,
        unpaid_leave_days: Decimal | None = None,
        lop_days: Decimal | None = None,
    ) -> dict:
        start, end = cache.period_start, cache.period_end
        holidays = self._holiday_set(cache, employee_id)
        counts = {
            "scheduled_working": 0,
            "week_off": 0,
            "holiday": 0,
            "present": 0,
            "absent": 0,
            "half_day": 0,
            "paid_leave": 0,
            "unpaid_leave": 0,
            "lop": 0,
            "other_attendance": 0,
        }
        leave_by_date = leave_by_date or {}
        attendance_by_date: dict[date, str] = {}
        for row in attendance_in_period:
            ad = row.get("attendance_date")
            if ad is not None:
                attendance_by_date[ad] = (row.get("attendance_status") or "").lower()

        for d in iter_dates_inclusive(start, end):
            roster = cache.roster_by_emp_date.get((employee_id, d))
            roster_shift = str(roster[0]) if roster else None
            roster_status = roster[1] if roster else None
            is_hol = d in holidays
            is_off = self._is_week_off(cache, employee_id, d)
            if is_hol:
                counts["holiday"] += 1
            elif is_off:
                counts["week_off"] += 1
            elif is_scheduled_working_day(
                on_date=d,
                is_holiday=is_hol,
                is_week_off=is_off,
                roster_shift_id=roster_shift,
                roster_status=roster_status,
            ):
                counts["scheduled_working"] += 1
                marker = leave_by_date.get(d)
                if marker is not None:
                    if marker.is_paid:
                        counts["paid_leave"] += 1
                    else:
                        counts["unpaid_leave"] += 1

            status = attendance_by_date.get(d)
            if status in {"present", "late", "work_from_home", "on_duty", "miss_punch"}:
                counts["present"] += 1
            elif status == "absent":
                counts["absent"] += 1
            elif status == "half_day":
                counts["half_day"] += 1
            elif status:
                counts["other_attendance"] += 1

        shift_id = self._resolve_shift_id(cache, employee_id, end)
        if paid_leave_days is not None:
            counts["paid_leave"] = float(paid_leave_days)
        if unpaid_leave_days is not None:
            counts["unpaid_leave"] = float(unpaid_leave_days)
        if lop_days is not None:
            counts["lop"] = float(lop_days)
        return {
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "denominator_mode": cache.denominator,
            "primary_shift_id": str(shift_id) if shift_id else None,
            "counts": counts,
        }

    def resolve_employee_pay_days(
        self,
        cache: _PeriodCalendarCache,
        employee_id: UUID,
        attendance_facts: list[dict],
        leave_facts: list[dict],
    ) -> EmployeePayDaysResult:
        start, end = cache.period_start, cache.period_end
        emp_attendance = [
            a
            for a in attendance_facts
            if a.get("employee_id") == employee_id
            and a.get("attendance_date") is not None
            and start <= a["attendance_date"] <= end
        ]
        emp_leave = [
            leave
            for leave in leave_facts
            if leave.get("employee_id") == employee_id
            and leave.get("start_date") is not None
            and leave.get("end_date") is not None
            and not (leave["end_date"] < start or leave["start_date"] > end)
        ]
        leave_days = sum(
            (Decimal(str(leave.get("days_count") or 0)) for leave in emp_leave),
            Decimal("0"),
        )
        leave_by_date = expand_leave_markers(emp_leave, start, end)
        overtime_minutes = sum(int(a.get("overtime_minutes") or 0) for a in emp_attendance)

        rules = cache.attendance_rules
        lop_statuses = {s.lower() for s in rules.get("lop_attendance_statuses", [])}
        half_lop_statuses = {s.lower() for s in rules.get("half_lop_attendance_statuses", [])}
        paid_statuses = {s.lower() for s in rules.get("paid_attendance_statuses", [])}

        period_days = self.period_denominator(cache, employee_id)
        primary_shift = self._resolve_shift_id(cache, employee_id, end)

        attendance_by_date: dict[date, str] = {}
        for row in emp_attendance:
            ad = row.get("attendance_date")
            if ad is not None:
                attendance_by_date[ad] = (row.get("attendance_status") or "").lower()

        scheduled_dates = self._scheduled_dates(cache, employee_id)
        lop_days, paid_leave_days, unpaid_leave_days = resolve_lop_on_scheduled_days(
            scheduled_dates,
            attendance_by_date,
            leave_by_date,
            lop_statuses=lop_statuses,
            half_lop_statuses=half_lop_statuses,
            paid_attendance_statuses=paid_statuses,
        )

        day_summary = self.build_day_summary(
            cache,
            employee_id,
            emp_attendance,
            leave_by_date=leave_by_date,
            paid_leave_days=paid_leave_days,
            unpaid_leave_days=unpaid_leave_days,
            lop_days=lop_days,
        )

        has_signals = bool(emp_attendance) or bool(leave_by_date)
        if not has_signals:
            return EmployeePayDaysResult(
                period_days=period_days,
                paid_days=period_days,
                lop_days=Decimal("0"),
                leave_days=leave_days,
                has_attendance=False,
                overtime_minutes=overtime_minutes,
                primary_shift_id=primary_shift,
                day_summary_json=day_summary,
            )

        paid_days = period_days - lop_days
        if paid_days < 0:
            paid_days = Decimal("0")

        return EmployeePayDaysResult(
            period_days=period_days,
            paid_days=paid_days,
            lop_days=lop_days,
            leave_days=leave_days,
            has_attendance=True,
            overtime_minutes=overtime_minutes,
            primary_shift_id=primary_shift,
            day_summary_json=day_summary,
        )
