"""Apply attendance sandwich LOP to hr_attendance rows."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.hr.domain.leave_accrual_calendar import leave_financial_year
from modules.hr.domain.sandwich_rules import (
    SANDWICH_TRIGGER_BOTH,
    append_sandwich_note,
    iter_dates_inclusive,
    parse_sandwich_original,
    sandwich_off_dates,
    strip_sandwich_note,
)
from modules.hr.models import HrAttendance, HrLeaveRequest, HrLeaveType
from modules.hr.service.engines.calendar_rules import is_weekly_off_day

PAID_SKIP_STATUSES = frozenset(
    {"present", "late", "on_duty", "work_from_home", "half_day", "miss_punch"}
)


def resolve_company_sandwich_settings(db: Session, company_id: UUID) -> dict:
    """Policy from payroll when available; leave-type flag is a fallback enable."""
    enabled = company_id in company_ids_with_sandwich_enabled(db)
    trigger = SANDWICH_TRIGGER_BOTH
    off_becomes = "lop"
    try:
        from modules.payroll.models.payroll_policy import PayPayrollPolicy

        row = db.scalar(
            select(PayPayrollPolicy).where(
                PayPayrollPolicy.is_deleted.is_(False),
                PayPayrollPolicy.company_id == company_id,
                PayPayrollPolicy.status == "active",
            ).limit(1)
        )
        if row is not None:
            if bool(getattr(row, "sandwich_enabled", False)):
                enabled = True
            trigger = str(getattr(row, "sandwich_triggers", None) or trigger)
            off_becomes = str(getattr(row, "sandwich_off_becomes", None) or off_becomes)
    except Exception:
        pass
    return {"enabled": enabled, "trigger": trigger, "off_becomes": off_becomes}


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
    trigger: str = SANDWICH_TRIGGER_BOTH,
    off_becomes: str = "lop",
) -> dict:
    """Mark sandwiched offs as absent (LOP) or leave; restore when the rule no longer applies."""
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
    sandwich_dates = sandwich_off_dates(
        window_start,
        window_end,
        is_non_working=is_non_working,
        attendance_status_by_date=status_map,
        approved_leave_dates=leave_dates,
        as_of=as_of,
        trigger=trigger,
    )
    become_lop = (off_becomes or "lop").strip().lower() != "leave"

    become_lop = (off_becomes or "lop").strip().lower() != "leave"
    target_status = "absent" if become_lop else None

    applied = 0
    reversed_n = 0
    created = 0
    leave_consumed = Decimal("0")

    for day in sandwich_dates:
        row = by_date.get(day)
        original_kind = _off_kind(day, holiday_dates)
        if row is None:
            status = "absent" if become_lop else original_kind
            row = HrAttendance(
                id=uuid4(),
                tenant_id=tenant_id,
                company_id=company_id,
                branch_id=branch_id,
                employee_id=employee_id,
                attendance_date=day,
                attendance_status=status,
                source="manual",
                status="recorded",
                notes=append_sandwich_note(None, original_kind),
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
        if become_lop:
            if row.attendance_status != "absent":
                row.attendance_status = "absent"
                row.notes = append_sandwich_note(row.notes, original)
                applied += 1
        else:
            if row.attendance_status == "absent":
                row.attendance_status = original
            row.notes = append_sandwich_note(row.notes, original)
            applied += 1

    if sandwich_dates and not become_lop:
        leave_consumed = _consume_sandwich_leave(
            db,
            company_id=company_id,
            employee_id=employee_id,
            days=Decimal(len(sandwich_dates)),
            as_of=as_of,
        )

    for day, row in list(by_date.items()):
        if day in sandwich_dates:
            continue
        original = parse_sandwich_original(row.notes)
        if original is None:
            continue
        row.attendance_status = original
        row.notes = strip_sandwich_note(row.notes)
        reversed_n += 1

    return {
        "applied": applied,
        "reversed": reversed_n,
        "created": created,
        "leave_consumed": float(leave_consumed),
        "sandwich_dates": len(sandwich_dates),
        "off_becomes": "lop" if become_lop else "leave",
    }


def _consume_sandwich_leave(
    db: Session,
    *,
    company_id: UUID,
    employee_id: UUID,
    days: Decimal,
    as_of: date,
) -> Decimal:
    """Debit paid leave balance for sandwiched offs. Returns days actually consumed."""
    if days <= 0:
        return Decimal("0")
    from modules.hr.models.leave_balance import HrLeaveBalance
    from modules.hr.service.engines.leave_balance_engine import LeaveBalanceEngine

    types = list(
        db.scalars(
            select(HrLeaveType).where(
                HrLeaveType.is_deleted.is_(False),
                HrLeaveType.company_id == company_id,
                HrLeaveType.status == "active",
                HrLeaveType.is_paid.is_(True),
            )
        ).all()
    )
    type_ids = [t.id for t in types]
    if not type_ids:
        return Decimal("0")
    balances = list(
        db.scalars(
            select(HrLeaveBalance).where(
                HrLeaveBalance.is_deleted.is_(False),
                HrLeaveBalance.employee_id == employee_id,
                HrLeaveBalance.company_id == company_id,
                HrLeaveBalance.balance_year == leave_financial_year(as_of),
                HrLeaveBalance.status == "open",
                HrLeaveBalance.leave_type_id.in_(type_ids),
            )
        ).all()
    )
    remaining = Decimal(str(days))
    consumed = Decimal("0")
    engine = LeaveBalanceEngine()
    for bal in sorted(balances, key=lambda b: Decimal(str(b.closing_balance or 0)), reverse=True):
        if remaining <= 0:
            break
        available = Decimal(str(bal.closing_balance or 0))
        if available <= 0:
            continue
        take = remaining if remaining <= available else available
        engine.apply_usage(bal, take)
        remaining -= take
        consumed += take
    return consumed


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
    sandwich_companies = {
        emp.company_id
        for emp in employments
        if emp.company_id and resolve_company_sandwich_settings(db, emp.company_id)["enabled"]
    }
    if not sandwich_companies:
        return {"sandwich_applied": 0, "sandwich_reversed": 0, "sandwich_created": 0, "sandwich_employees": 0}

    window_start = as_of - timedelta(days=14)
    window_end = as_of
    applied = reversed_n = created = employees = 0

    for emp in employments:
        if emp.company_id not in sandwich_companies:
            continue
        settings = resolve_company_sandwich_settings(db, emp.company_id)
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
            trigger=settings["trigger"],
            off_becomes=settings["off_becomes"],
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
