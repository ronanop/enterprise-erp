"""Upcoming birthday window helpers for HR digest notifications."""

from datetime import date


def next_birthday_on_or_after(dob: date, today: date) -> date:
    """Return the next birthday on or after today, handling Feb 29."""
    year = today.year
    try:
        candidate = dob.replace(year=year)
    except ValueError:
        candidate = date(year, 2, 28)
    if candidate < today:
        year += 1
        try:
            candidate = dob.replace(year=year)
        except ValueError:
            candidate = date(year, 2, 28)
    return candidate


def is_upcoming_birthday(dob: date | None, today: date, *, days: int = 30) -> bool:
    if dob is None:
        return False
    nxt = next_birthday_on_or_after(dob, today)
    delta = (nxt - today).days
    return 0 <= delta <= days
