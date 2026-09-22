from datetime import date
from decimal import Decimal

from modules.payroll.domain.payroll_day_ledger import (
    calendar_days_in_period,
    is_scheduled_working_day,
    lop_from_attendance_records,
)


def test_calendar_days_jan_20_to_feb_19():
    assert calendar_days_in_period(date(2026, 1, 20), date(2026, 2, 19)) == 31


def test_scheduled_excludes_holiday_and_week_off():
    assert not is_scheduled_working_day(
        on_date=date(2026, 1, 25),
        is_holiday=True,
        is_week_off=False,
        roster_shift_id=None,
        roster_status=None,
    )
    assert not is_scheduled_working_day(
        on_date=date(2026, 1, 25),
        is_holiday=False,
        is_week_off=True,
        roster_shift_id=None,
        roster_status=None,
    )


def test_lop_from_attendance():
    rows = [
        {"attendance_status": "absent"},
        {"attendance_status": "half_day"},
        {"attendance_status": "present"},
    ]
    assert lop_from_attendance_records(
        rows, lop_statuses={"absent"}, half_lop_statuses={"half_day"}
    ) == Decimal("1.5")
