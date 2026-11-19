"""Unit tests for leave day counting and FNF amount helpers."""

from datetime import date
from decimal import Decimal

from modules.hr.service.fnf_amounts import basic_from_gross, compute_gratuity, daily_rate_from_gross
from modules.hr.service.leave_service import _count_leave_days


def test_sandwich_on_counts_inclusive_calendar_days():
    fri = date(2026, 7, 24)
    mon = date(2026, 7, 27)
    assert _count_leave_days(fri, mon, set(), sandwich=True) == Decimal("4")


def test_sandwich_off_excludes_weekends_and_holidays():
    fri = date(2026, 7, 24)
    mon = date(2026, 7, 27)
    sat = date(2026, 7, 25)
    sun = date(2026, 7, 26)
    holiday = date(2026, 7, 24)  # Friday holiday
    non_working = {sat, sun, holiday}
    # Only Monday remains a working day
    assert _count_leave_days(fri, mon, non_working, sandwich=False) == Decimal("1")


def test_gratuity_requires_five_years():
    amt, yrs = compute_gratuity(
        date_of_joining=date(2024, 1, 1),
        last_working_date=date(2026, 1, 1),
        basic=Decimal("10000"),
    )
    assert yrs < 5
    assert amt == Decimal("0")


def test_gratuity_formula_after_five_years():
    amt, yrs = compute_gratuity(
        date_of_joining=date(2018, 1, 1),
        last_working_date=date(2026, 1, 1),
        basic=Decimal("10000"),
    )
    assert yrs >= 5
    # (15/26)*10000*8 ≈ 4615.3846
    assert amt > Decimal("4000")


def test_daily_rate_from_gross_uses_basic_over_30():
    rate = daily_rate_from_gross(Decimal("100000"))
    basic = basic_from_gross(Decimal("100000"))
    assert basic == Decimal("40000.0000")
    assert rate == Decimal("1333.3333")
