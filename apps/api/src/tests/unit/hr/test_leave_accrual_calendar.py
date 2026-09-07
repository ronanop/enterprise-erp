from datetime import date

from modules.hr.domain.leave_accrual_calendar import completed_calendar_month_yyyymm, leave_financial_year


def test_completed_month_on_first_of_march():
    assert completed_calendar_month_yyyymm(date(2026, 3, 1)) == "2026-02"


def test_completed_month_mid_february():
    assert completed_calendar_month_yyyymm(date(2026, 2, 15)) == "2026-01"


def test_completed_month_january():
    assert completed_calendar_month_yyyymm(date(2026, 1, 5)) == "2025-12"


def test_leave_financial_year_march_to_march():
    assert leave_financial_year(date(2026, 3, 1)) == 2026
    assert leave_financial_year(date(2026, 7, 20)) == 2026
    assert leave_financial_year(date(2027, 2, 28)) == 2026
    assert leave_financial_year(date(2026, 2, 15)) == 2025
