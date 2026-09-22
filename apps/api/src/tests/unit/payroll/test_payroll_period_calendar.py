from datetime import date

from modules.payroll.domain.payroll_period_calendar import (
    payroll_anchor_for_date,
    payroll_period_bounds_day_to_day,
    payroll_period_code,
)


def test_feb_2026_payroll_bounds():
    start, end = payroll_period_bounds_day_to_day(2026, 2, cycle_start_day=20)
    assert start == date(2026, 1, 20)
    assert end == date(2026, 2, 19)


def test_jan_2026_payroll_bounds_cross_year():
    start, end = payroll_period_bounds_day_to_day(2026, 1, cycle_start_day=20)
    assert start == date(2025, 12, 20)
    assert end == date(2026, 1, 19)


def test_period_code():
    assert payroll_period_code(2026, 2) == "PAY-2026-02"


def test_anchor_for_date():
    assert payroll_anchor_for_date(date(2026, 1, 19)) == (2026, 1)
    assert payroll_anchor_for_date(date(2026, 1, 20)) == (2026, 2)
    assert payroll_anchor_for_date(date(2026, 12, 20)) == (2027, 1)
