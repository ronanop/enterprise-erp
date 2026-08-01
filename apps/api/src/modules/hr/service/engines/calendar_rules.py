"""Shared weekly-off / holiday / hours-status helpers for attendance + leave."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any, Iterable, Sequence


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


def _parse_hhmm(value: Any) -> time | None:
    if value is None:
        return None
    if isinstance(value, time):
        return value
    raw = str(value).strip()
    if not raw:
        return None
    try:
        parts = raw.split(":")
        return time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
    except (TypeError, ValueError, IndexError):
        return None


def pick_arrival_window(
    *,
    arrival_policy_enabled: bool,
    applies_to_all_shifts: bool,
    window_start: Any,
    ok_until: Any,
    after_status: str | None,
    shift_windows_json: list | dict | None,
    shift_id: str | None = None,
    shift_code: str | None = None,
) -> dict[str, Any] | None:
    """Return active arrival window config for a shift, or None when disabled."""
    if not arrival_policy_enabled:
        return None

    overrides: list = []
    if isinstance(shift_windows_json, list):
        overrides = shift_windows_json
    elif isinstance(shift_windows_json, dict):
        overrides = shift_windows_json.get("windows") or []

    match = None
    for row in overrides:
        if not isinstance(row, dict):
            continue
        sid = str(row.get("shift_id") or "")
        scode = str(row.get("shift_code") or "").upper()
        if shift_id and sid and sid == str(shift_id):
            match = row
            break
        if shift_code and scode and scode == str(shift_code).upper():
            match = row
            break

    if match is not None:
        return {
            "window_start": _parse_hhmm(match.get("window_start") or match.get("ok_from")),
            "ok_until": _parse_hhmm(match.get("ok_until") or match.get("window_end")),
            "after_status": str(match.get("after_status") or after_status or "half_day").lower(),
        }

    if applies_to_all_shifts or not overrides:
        start = _parse_hhmm(window_start)
        until = _parse_hhmm(ok_until)
        if start is None and until is None:
            return None
        return {
            "window_start": start,
            "ok_until": until,
            "after_status": str(after_status or "half_day").lower(),
        }
    return None


def resolve_arrival_status(
    *,
    check_in_at: datetime,
    shift_start: time | None,
    grace_minutes: int = 0,
    late_mark_after_minutes: int = 15,
    window: dict[str, Any] | None,
) -> tuple[str, int]:
    """
    Resolve check-in status from arrival window policy.

    Example: window 10:00–11:00, after → half_day
    - before/during window (and within grace of shift start): present or late
    - after ok_until: half_day / absent / late (per after_status)
    """
    local = check_in_at
    if local.tzinfo is not None:
        # compare as local wall-clock
        punched = local.timetz().replace(tzinfo=None)
    else:
        punched = local.time()

    late_minutes = 0
    if shift_start is not None:
        start_dt = datetime.combine(local.date(), shift_start)
        punched_dt = datetime.combine(local.date(), punched)
        late_minutes = max(0, int((punched_dt - start_dt).total_seconds() // 60) - int(grace_minutes or 0))

    if not window:
        if late_minutes > int(late_mark_after_minutes or 0):
            return "late", late_minutes
        if late_minutes > 0:
            return "late", late_minutes
        return "present", 0

    ok_until = window.get("ok_until")
    after_status = str(window.get("after_status") or "half_day").lower()
    if ok_until is not None and punched > ok_until:
        if after_status == "absent":
            return "absent", late_minutes
        if after_status == "late":
            return "late", late_minutes
        return "half_day", late_minutes

    if late_minutes > 0:
        return "late", late_minutes
    return "present", 0


def aggregate_biometric_punches(
    events: Sequence[datetime | str],
    *,
    punch_mode: str = "first_in_last_out",
    check_in_at: datetime | None = None,
    check_out_at: datetime | None = None,
) -> dict[str, Any]:
    """
    Aggregate device punches into daily check-in / check-out + worked hours.

    - first_in_last_out: earliest = in, latest = out
    - every_punch: pair consecutive punches (1-2, 3-4, …) and sum session minutes
    """
    stamps: list[datetime] = []
    for ev in events:
        if isinstance(ev, datetime):
            stamps.append(ev)
        else:
            try:
                stamps.append(datetime.fromisoformat(str(ev).replace("Z", "+00:00")))
            except ValueError:
                continue
    if check_in_at:
        stamps.append(check_in_at)
    if check_out_at:
        stamps.append(check_out_at)
    stamps = sorted(set(stamps))
    if not stamps:
        return {
            "check_in_at": check_in_at,
            "check_out_at": check_out_at,
            "total_hours": None,
            "punch_count": 0,
            "sessions": [],
        }

    mode = (punch_mode or "first_in_last_out").lower()
    if mode == "every_punch":
        sessions: list[dict[str, Any]] = []
        total_min = 0
        for i in range(0, len(stamps) - 1, 2):
            a, b = stamps[i], stamps[i + 1]
            mins = max(0, int((b - a).total_seconds() // 60))
            total_min += mins
            sessions.append({"in": a.isoformat(), "out": b.isoformat(), "minutes": mins})
        return {
            "check_in_at": stamps[0],
            "check_out_at": stamps[-1] if len(stamps) > 1 else None,
            "total_hours": round(total_min / 60, 2) if total_min else None,
            "punch_count": len(stamps),
            "sessions": sessions,
        }

    # first_in_last_out
    first, last = stamps[0], stamps[-1]
    hours = None
    if last > first:
        hours = round((last - first).total_seconds() / 3600, 2)
    return {
        "check_in_at": first,
        "check_out_at": last if last != first else None,
        "total_hours": hours,
        "punch_count": len(stamps),
        "sessions": [{"in": first.isoformat(), "out": (last if last != first else None)}],
    }


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
