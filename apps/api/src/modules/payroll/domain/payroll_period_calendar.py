"""Payroll period date math (20th–20th and variants)."""

from __future__ import annotations

from datetime import date, timedelta


def payroll_period_bounds_day_to_day(
    payroll_year: int,
    payroll_month: int,
    *,
    cycle_start_day: int = 20,
) -> tuple[date, date]:
    """Return inclusive start/end for the salary month anchor.

    ``payroll_month`` is the payment / salary month (e.g. February payroll →
    20 Jan through 19 Feb when ``cycle_start_day`` is 20).
    """
    if not 1 <= payroll_month <= 12:
        raise ValueError("payroll_month must be 1–12")
    if not 1 <= cycle_start_day <= 28:
        raise ValueError("cycle_start_day must be 1–28")

    if payroll_month == 1:
        start = date(payroll_year - 1, 12, cycle_start_day)
    else:
        start = date(payroll_year, payroll_month - 1, cycle_start_day)

    end_day = cycle_start_day - 1
    end = date(payroll_year, payroll_month, end_day)
    return start, end


def payroll_period_code(payroll_year: int, payroll_month: int) -> str:
    return f"PAY-{payroll_year:04d}-{payroll_month:02d}"


def payroll_period_display_name(start: date, end: date, payroll_year: int, payroll_month: int) -> str:
    month_names = (
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    )
    anchor = month_names[payroll_month - 1]
    return (
        f"Payroll {anchor} {payroll_year} "
        f"({start.day} {month_names[start.month - 1]} {start.year} – "
        f"{end.day} {month_names[end.month - 1]} {end.year})"
    )


def default_payment_date(payroll_year: int, payroll_month: int, cycle_start_day: int = 20) -> date:
    """Default pay date: cycle start day of the anchor month."""
    return date(payroll_year, payroll_month, cycle_start_day)


def payroll_anchor_for_date(on_date: date, *, cycle_start_day: int = 20) -> tuple[int, int]:
    """Map a calendar date to (payroll_year, payroll_month) for the 20–20 window containing it."""
    if on_date.day >= cycle_start_day:
        if on_date.month == 12:
            return on_date.year + 1, 1
        return on_date.year, on_date.month + 1
    return on_date.year, on_date.month


def iter_payroll_months(
    start_year: int,
    start_month: int,
    count: int,
) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    y, m = start_year, start_month
    for _ in range(count):
        out.append((y, m))
        if m == 12:
            y, m = y + 1, 1
        else:
            m += 1
    return out
