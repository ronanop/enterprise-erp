"""Shared weekly-off / holiday / hours-status helpers for attendance + leave."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Iterable, Sequence


WEEKLY_OFF_RULES = frozenset(
    {
        "sunday",
        "saturday",
        "alternate_saturday",
        "second_saturday",
        "rotating",
        "custom",
    }
)


def is_second_saturday(day: date) -> bool:
    return day.weekday() == 5 and 8 <= day.day <= 14


def is_alternate_saturday(day: date, *, start: date | None = None) -> bool:
    """Even ISO weeks are offs; if start given, alternate from that Saturday."""
    if day.weekday() != 5:
        return False
    if start is not None:
        delta_weeks = (day - start).days // 7
        return delta_weeks % 2 == 0
    return day.isocalendar()[1] % 2 == 0


def is_weekly_off_day(
    day: date,
    rules: Sequence[str] | None,
    *,
    custom_weekdays: Sequence[int] | None = None,
    alternate_start: date | None = None,
) -> bool:
    """Return True when *day* is a configured weekly off."""
    if not rules:
        # India-safe default when no policy configured
        return day.weekday() >= 5
    rule_set = {str(r).strip().lower() for r in rules if r}
    if "sunday" in rule_set and day.weekday() == 6:
        return True
    if "saturday" in rule_set and day.weekday() == 5:
        return True
    if "second_saturday" in rule_set and is_second_saturday(day):
        return True
    if "alternate_saturday" in rule_set and is_alternate_saturday(day, start=alternate_start):
        return True
    if "rotating" in rule_set and day.weekday() == 6:
        # Rotating offs without a roster entry: treat Sunday as the base off day.
        return True
    if "custom" in rule_set and custom_weekdays:
        return day.weekday() in {int(w) for w in custom_weekdays}
    return False


def holiday_dates_from_json(holidays_json) -> set[date]:
    out: set[date] = set()
    if not holidays_json:
        return out
    items = holidays_json
    if isinstance(holidays_json, dict):
        items = holidays_json.get("days") or holidays_json.get("holidays") or []
    if not isinstance(items, list):
        return out
    for item in items:
        raw = None
        if isinstance(item, dict):
            raw = item.get("date") or item.get("holiday_date")
        else:
            raw = item
        if not raw:
            continue
        try:
            out.add(date.fromisoformat(str(raw)[:10]))
        except ValueError:
            continue
    return out


def resolve_status_from_hours(
    *,
    total_hours: Decimal | float | None,
    half_day_hours: Decimal | float | None,
    full_day_hours: Decimal | float | None,
    current_status: str | None,
    early_leave_minutes: int | None = None,
    early_leave_half_day_minutes: int = 120,
) -> str:
    """
    Derive attendance_status from worked hours + early-leave policy.

    Rules (enterprise default):
    - hours < half_day_hours → half_day
    - half_day_hours <= hours < full_day_hours → half_day
    - early leave ≥ threshold → half_day
    - otherwise keep present/late/on_duty
    """
    status = (current_status or "present").strip().lower()
    if status in {"absent", "holiday", "week_off", "on_duty", "work_from_home", "miss_punch"}:
        # Preserve non-presence intentional statuses except when hours prove half-day work.
        if status != "on_duty" and status != "work_from_home":
            return status

    half = float(half_day_hours if half_day_hours is not None else 4)
    full = float(full_day_hours if full_day_hours is not None else 8)
    hours = float(total_hours or 0)

    if early_leave_minutes is not None and early_leave_minutes >= int(early_leave_half_day_minutes or 120):
        if status in {"present", "late", "on_duty", "work_from_home", "half_day"}:
            return "half_day"

    if hours > 0 and hours < full:
        return "half_day"
    if hours > 0 and hours < half:
        return "half_day"
    return status if status else "present"


def expand_non_working_dates(
    start: date,
    end: date,
    *,
    rules: Sequence[str] | None,
    custom_weekdays: Sequence[int] | None = None,
    alternate_start: date | None = None,
    holiday_dates: Iterable[date] | None = None,
) -> set[date]:
    holidays = set(holiday_dates or [])
    out: set[date] = set()
    cur = start
    from datetime import timedelta

    while cur <= end:
        if is_weekly_off_day(
            cur,
            rules,
            custom_weekdays=custom_weekdays,
            alternate_start=alternate_start,
        ):
            out.add(cur)
        if cur in holidays:
            out.add(cur)
        cur += timedelta(days=1)
    return out
