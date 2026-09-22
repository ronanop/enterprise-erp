"""Apply attendance sandwich LOP to hr_attendance rows."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.hr.domain.sandwich_rules import (
    append_sandwich_note,
    iter_dates_inclusive,
    parse_sandwich_original,
    sandwich_lop_dates,
    strip_sandwich_note,
)
from modules.hr.models import HrAttendance, HrLeaveRequest, HrLeaveType
from modules.hr.service.engines.calendar_rules import is_weekly_off_day

PAID_SKIP_STATUSES = frozenset(
    {"present", "late", "on_duty", "work_from_home", "half_day", "miss_punch"}
)


def company_ids_with_sandwich_enabled(db: Session) -> set[UUID]:
    rows = db.scalars(
        select(HrLeaveType.company_id).where(
            HrLeaveType.is_deleted.is_(False),
            HrLeaveType.status == "active",
            HrLeaveType.sandwich_rule_enabled.is_(True),
        )
    ).all()
    return {cid for cid in rows if cid is not None}


def approved_leave_dates(
    db: Session,
    *,
    employee_id: UUID,
    window_start: date,
    window_end: date,
) -> set[date]:
    rows = db.scalars(
        select(HrLeaveRequest).where(
            HrLeaveRequest.is_deleted.is_(False),
            HrLeaveRequest.status == "approved",
            HrLeaveRequest.employee_id == employee_id,
            HrLeaveRequest.start_date <= window_end,
            HrLeaveRequest.end_date >= window_start,
        )
    ).all()
    out: set[date] = set()
    for row in rows:
        out.update(iter_dates_inclusive(row.start_date, row.end_date))
    return out


def _off_kind(day: date, holiday_dates: set[date]) -> str:
    return "holiday" if day in holiday_dates else "week_off"


def apply_sandwich_for_employee(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    branch_id: UUID | None,
    employee_id: UUID,
    window_start: date,
    window_end: date,
    as_of: date,
    is_non_working,
    holiday_dates: set[date],
    approved_dates: set[date] | None = None,
) -> dict:
    """Mark sandwiched offs as absent; restore them when approved leave covers flanks."""
    rows = list(
        db.scalars(
            select(HrAttendance).where(
                HrAttendance.is_deleted.is_(False),
                HrAttendance.employee_id == employee_id,
                HrAttendance.attendance_date >= window_start,
                HrAttendance.attendance_date <= window_end,
            )
        ).all()
    )
    by_date = {r.attendance_date: r for r in rows}
    status_map = {d: r.attendance_status for d, r in by_date.items()}
    leave_dates = approved_dates if approved_dates is not None else approved_leave_dates(
        db,
        employee_id=employee_id,
        window_start=window_start,
        window_end=window_end,
    )
    sandwich_dates = sandwich_lop_dates(
        window_start,
        window_end,
        is_non_working=is_non_working,
        attendance_status_by_date=status_map,
        approved_leave_dates=leave_dates,
        as_of=as_of,
    )

    applied = 0
    reversed_n = 0
    created = 0

    for day in sandwich_dates:
        row = by_date.get(day)
        if row is None:
            original = _off_kind(day, holiday_dates)
            row = HrAttendance(
                id=uuid4(),
                tenant_id=tenant_id,
                company_id=company_id,
                branch_id=branch_id,
                employee_id=employee_id,
                attendance_date=day,
                attendance_status="absent",
                source="manual",
                status="recorded",
                notes=append_sandwich_note(None, original),
                created_by=None,
                updated_by=None,
            )
            db.add(row)
            by_date[day] = row
            created += 1
            applied += 1
            continue
        if row.attendance_status in PAID_SKIP_STATUSES:
            continue
        original = parse_sandwich_original(row.notes) or (
            row.attendance_status if row.attendance_status in {"week_off", "holiday"} else None
        )
        if original is None:
            continue
        if row.attendance_status != "absent":
            row.attendance_status = "absent"
            row.notes = append_sandwich_note(row.notes, original)
            applied += 1

    for day, row in list(by_date.items()):
        if day in sandwich_dates:
            continue
        original = parse_sandwich_original(row.notes)
        if original is None:
            continue
        row.attendance_status = original
        row.notes = strip_sandwich_note(row.notes)
        reversed_n += 1

    return {"applied": applied, "reversed": reversed_n, "created": created}


def make_is_non_working(policy, holiday_dates: set[date]):
    holidays = set(holiday_dates or [])
    rules = policy.rules_json if policy else None
    custom = policy.custom_weekdays_json if policy else None
    alt = policy.alternate_saturday_start if policy else None

    def _fn(day: date) -> bool:
        if day in holidays:
            return True
        return is_weekly_off_day(day, rules, custom_weekdays=custom, alternate_start=alt)

    return _fn


def apply_sandwich_after_auto_absent(
    db: Session,
    as_of: date,
    employments: list,
    holidays_by_company: dict,
    policy_by_company: dict,
) -> dict:
    """Re-evaluate sandwich for employments in companies with the rule enabled."""
    sandwich_companies = company_ids_with_sandwich_enabled(db)
    if not sandwich_companies:
        return {"sandwich_applied": 0, "sandwich_reversed": 0, "sandwich_created": 0, "sandwich_employees": 0}

    window_start = as_of - timedelta(days=14)
    window_end = as_of
    applied = reversed_n = created = employees = 0

    for emp in employments:
        if emp.company_id not in sandwich_companies:
            continue
        policy = policy_by_company.get(emp.company_id)
        holidays = holidays_by_company.get(emp.company_id, set())
        stats = apply_sandwich_for_employee(
            db,
            tenant_id=emp.tenant_id,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            employee_id=emp.employee_id,
            window_start=window_start,
            window_end=window_end,
            as_of=as_of,
            is_non_working=make_is_non_working(policy, holidays),
            holiday_dates=holidays,
        )
        applied += stats["applied"]
        reversed_n += stats["reversed"]
        created += stats["created"]
        employees += 1

    return {
        "sandwich_applied": applied,
        "sandwich_reversed": reversed_n,
        "sandwich_created": created,
        "sandwich_employees": employees,
    }
