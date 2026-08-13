"""Leave cycle apply rules: calendar month 1–31, credit after month end.

Payroll 20–20 is separate. Leave dates belong to the calendar month of each day.
Monthly credit for month M posts after M ends (typically on the 1st of M+1).
Until then, that month's credit cannot be used. After it posts, past leave dates
in M may be applied/covered using the newly credited balance.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from modules.hr.domain.exceptions import InvalidLeaveRequestState
from modules.hr.domain.leave_accrual_calendar import completed_calendar_month_yyyymm


def yyyymm(d: date) -> str:
    return d.strftime("%Y-%m")


def first_day_of_next_month(yyyymm_value: str) -> date:
    year = int(yyyymm_value[:4])
    month = int(yyyymm_value[5:7])
    if month == 12:
        return date(year + 1, 1, 1)
    return date(year, month + 1, 1)


def iter_dates(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def calendar_months_in_range(start: date, end: date) -> list[str]:
    months: list[str] = []
    seen: set[str] = set()
    for d in iter_dates(start, end):
        key = yyyymm(d)
        if key not in seen:
            seen.add(key)
            months.append(key)
    return months


def assert_no_future_calendar_month_leave(
    start_date: date,
    end_date: date,
    *,
    today: date | None = None,
) -> None:
    """Leave days may be in the current or past calendar months only.

    Future calendar months are blocked so employees cannot consume an upcoming
    month's leave cycle before that month starts. Past dates are allowed so that
    after month-end credit posts, prior holidays can be covered.
    """
    if end_date < start_date:
        raise InvalidLeaveRequestState("end_date must be on or after start_date")
    ref = today or date.today()
    for d in iter_dates(start_date, end_date):
        if (d.year, d.month) > (ref.year, ref.month):
            raise InvalidLeaveRequestState(
                "Cannot apply leave for a future calendar month before it starts. "
                "Leave cycle is calendar 1–last day (not payroll 20–20). "
                "Monthly leave credit for a month is added after that month ends; "
                "after credit posts you may apply leave for past dates in that month."
            )


def months_waiting_on_unposted_credit(
    leave_months: list[str],
    *,
    last_accrual_yyyymm: str | None,
    today: date | None = None,
) -> list[str]:
    """Leave months whose monthly credit is not yet available.

    Credit for month M is available once the calendar month has completed
    (``completed_calendar_month_yyyymm(today) >= M``) and accrual has been
    recorded (``last_accrual_yyyymm >= M``). While still inside M, credit for M
    is treated as unposted / not usable yet.
    """
    ref = today or date.today()
    completed = completed_calendar_month_yyyymm(ref)
    last = last_accrual_yyyymm or ""
    waiting: list[str] = []
    for month in leave_months:
        if last >= month:
            continue
        # Month not finished yet → credit not due
        if completed < month:
            waiting.append(month)
            continue
        # Month finished but accrual job not recorded yet — still waiting
        waiting.append(month)
    return waiting


def assert_leave_balance_for_cycle(
    *,
    days_count: Decimal | float | int | str,
    closing_balance: Decimal | float | int | str | None,
    start_date: date,
    end_date: date,
    last_accrual_yyyymm: str | None = None,
    monthly_credit_days: Decimal | float | int | str | None = None,
    today: date | None = None,
) -> None:
    """Enforce posted-balance only; explain unposted monthly credit clearly."""
    if closing_balance is None:
        raise InvalidLeaveRequestState(
            "Open leave balance not found for this leave type and year. "
            "Assign a leave balance before applying."
        )

    days = Decimal(str(days_count))
    available = Decimal(str(closing_balance))
    if days <= 0:
        return
    if available >= days:
        return

    ref = today or date.today()
    leave_months = calendar_months_in_range(start_date, end_date)
    monthly = Decimal(str(monthly_credit_days or 0))
    waiting = months_waiting_on_unposted_credit(
        leave_months,
        last_accrual_yyyymm=last_accrual_yyyymm,
        today=ref,
    )

    if waiting and monthly > 0:
        month = waiting[0]
        completed = completed_calendar_month_yyyymm(ref)
        if completed < month:
            credit_on = first_day_of_next_month(month)
            raise InvalidLeaveRequestState(
                f"Insufficient leave balance ({available} available, {days} required). "
                f"Monthly credit for {month} is added on or after {credit_on.isoformat()} "
                f"(after that calendar month ends — leave cycle 1–last day, not payroll 20–20). "
                f"You cannot use that credit early. After it posts, you may apply leave for "
                f"these dates (including past dates such as {month}-21…)."
            )
        raise InvalidLeaveRequestState(
            f"Insufficient leave balance ({available} available, {days} required). "
            f"Monthly credit for {month} is due but not posted yet on this balance "
            f"(last accrual {last_accrual_yyyymm or 'none'}). Retry after the accrual job runs."
        )

    raise InvalidLeaveRequestState(
        f"Insufficient leave balance ({available} available, {days} required)."
    )


def validate_leave_cycle_application(
    *,
    start_date: date,
    end_date: date,
    days_count: Decimal | float | int | str,
    closing_balance: Decimal | float | int | str | None,
    last_accrual_yyyymm: str | None = None,
    monthly_credit_days: Decimal | float | int | str | None = None,
    today: date | None = None,
    require_balance: bool = True,
) -> None:
    """Full apply/submit gate for leave calendar cycle rules."""
    ref = today or date.today()
    assert_no_future_calendar_month_leave(start_date, end_date, today=ref)
    if require_balance:
        assert_leave_balance_for_cycle(
            days_count=days_count,
            closing_balance=closing_balance,
            start_date=start_date,
            end_date=end_date,
            last_accrual_yyyymm=last_accrual_yyyymm,
            monthly_credit_days=monthly_credit_days,
            today=ref,
        )
