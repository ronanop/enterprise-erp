"""Unit tests for upcoming birthday window."""

from datetime import date

from modules.hr.service.birthday_window import is_upcoming_birthday, next_birthday_on_or_after


def test_today_is_upcoming() -> None:
    today = date(2026, 8, 14)
    assert is_upcoming_birthday(date(1990, 8, 14), today) is True


def test_within_thirty_days() -> None:
    today = date(2026, 8, 14)
    assert is_upcoming_birthday(date(1990, 9, 1), today) is True
    assert is_upcoming_birthday(date(1990, 10, 1), today) is False


def test_wraps_year_boundary() -> None:
    today = date(2026, 12, 20)
    nxt = next_birthday_on_or_after(date(1990, 1, 5), today)
    assert nxt == date(2027, 1, 5)
    assert is_upcoming_birthday(date(1990, 1, 5), today) is True


def test_missing_dob() -> None:
    assert is_upcoming_birthday(None, date(2026, 8, 14)) is False
