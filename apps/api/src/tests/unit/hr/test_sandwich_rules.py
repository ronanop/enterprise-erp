"""Unit tests for attendance sandwich LOP."""

from datetime import date

from modules.hr.domain.sandwich_rules import (
    is_unauthorized_flank,
    sandwich_lop_dates,
)


def _weekend(day: date) -> bool:
    return day.weekday() >= 5


def test_unauthorized_flank_skips_approved_leave():
    assert (
        is_unauthorized_flank(attendance_status="absent", has_approved_leave=True) is False
    )


def test_unauthorized_flank_absent_without_leave():
    assert (
        is_unauthorized_flank(attendance_status="absent", has_approved_leave=False) is True
    )


def test_unauthorized_flank_missing_row_without_leave():
    assert is_unauthorized_flank(attendance_status=None, has_approved_leave=False) is True


def test_unauthorized_flank_present_is_not_sandwich():
    assert (
        is_unauthorized_flank(attendance_status="present", has_approved_leave=False) is False
    )


def test_sandwich_applies_when_both_flanks_absent_without_leave():
    # Fri 24 Jul 2026, Sat 25, Sun 26, Mon 27
    fri = date(2026, 7, 24)
    sat = date(2026, 7, 25)
    sun = date(2026, 7, 26)
    mon = date(2026, 7, 27)
    dates = sandwich_lop_dates(
        date(2026, 7, 20),
        date(2026, 7, 31),
        is_non_working=_weekend,
        attendance_status_by_date={fri: "absent", mon: "absent"},
        approved_leave_dates=set(),
        as_of=mon,
    )
    assert dates == {sat, sun}


def test_sandwich_not_applied_when_approved_leave_covers_flanks():
    fri = date(2026, 7, 24)
    mon = date(2026, 7, 27)
    dates = sandwich_lop_dates(
        date(2026, 7, 20),
        date(2026, 7, 31),
        is_non_working=_weekend,
        attendance_status_by_date={fri: "absent", mon: "absent"},
        approved_leave_dates={fri, mon},
        as_of=mon,
    )
    assert dates == set()


def test_sandwich_not_applied_when_one_flank_is_present():
    fri = date(2026, 7, 24)
    mon = date(2026, 7, 27)
    dates = sandwich_lop_dates(
        date(2026, 7, 20),
        date(2026, 7, 31),
        is_non_working=_weekend,
        attendance_status_by_date={fri: "absent", mon: "present"},
        approved_leave_dates=set(),
        as_of=mon,
    )
    assert dates == set()


def test_sandwich_waits_until_next_working_day_is_known():
    fri = date(2026, 7, 24)
    sat = date(2026, 7, 25)
    dates = sandwich_lop_dates(
        date(2026, 7, 20),
        date(2026, 7, 31),
        is_non_working=_weekend,
        attendance_status_by_date={fri: "absent"},
        approved_leave_dates=set(),
        as_of=sat,
    )
    assert dates == set()


def test_sandwich_applies_without_leave_balance_check():
    """Unused leave balance is irrelevant — only approved leave blocks sandwich."""
    fri = date(2026, 7, 24)
    sat = date(2026, 7, 25)
    sun = date(2026, 7, 26)
    mon = date(2026, 7, 27)
    dates = sandwich_lop_dates(
        date(2026, 7, 20),
        date(2026, 7, 31),
        is_non_working=_weekend,
        attendance_status_by_date={fri: "absent", mon: "absent"},
        approved_leave_dates=set(),
        as_of=mon,
    )
    assert sat in dates and sun in dates
