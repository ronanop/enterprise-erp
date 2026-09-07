"""Plan auto-marked attendance days from joining through today."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Callable, Iterable

# (iso date not used — callers get date + status)
AttendanceDay = tuple[date, str]


def each_day(start: date, end: date) -> list[date]:
    if end < start:
        return []
    out: list[date] = []
    cur = start
    while cur <= end:
        out.append(cur)
        cur += timedelta(days=1)
    return out


def plan_auto_attendance_days(
    start: date,
    end: date,
    *,
    holidays: Iterable[date],
    is_weekly_off: Callable[[date], bool],
    leave_dates: Iterable[date],
    existing_dates: Iterable[date],
) -> list[AttendanceDay]:
    """Present on working days; week_off / holiday otherwise. Skip leave and existing rows."""
    holiday_set = set(holidays)
    leave_set = set(leave_dates)
    existing = set(existing_dates)
    planned: list[AttendanceDay] = []
    for day in each_day(start, end):
        if day in existing or day in leave_set:
            continue
        if day in holiday_set:
            planned.append((day, "holiday"))
        elif is_weekly_off(day):
            planned.append((day, "week_off"))
        else:
            planned.append((day, "present"))
    return planned
