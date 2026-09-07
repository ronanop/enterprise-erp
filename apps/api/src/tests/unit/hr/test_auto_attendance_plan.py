from datetime import date

from modules.hr.domain.auto_attendance_plan import plan_auto_attendance_days


def test_auto_attendance_marks_present_week_off_holiday_skips_leave() -> None:
    start = date(2026, 9, 1)  # Tuesday
    end = date(2026, 9, 7)  # Monday
    holidays = {date(2026, 9, 2)}  # Wednesday
    leave = {date(2026, 9, 3)}  # Thursday
    existing = {date(2026, 9, 1)}  # already punched Tuesday

    def weekend(day: date) -> bool:
        return day.weekday() >= 5

    rows = plan_auto_attendance_days(
        start,
        end,
        holidays=holidays,
        is_weekly_off=weekend,
        leave_dates=leave,
        existing_dates=existing,
    )
    by_day = {d: s for d, s in rows}
    assert date(2026, 9, 1) not in by_day
    assert by_day[date(2026, 9, 2)] == "holiday"
    assert date(2026, 9, 3) not in by_day
    assert by_day[date(2026, 9, 4)] == "present"
    assert by_day[date(2026, 9, 5)] == "week_off"
    assert by_day[date(2026, 9, 6)] == "week_off"
    assert by_day[date(2026, 9, 7)] == "present"
