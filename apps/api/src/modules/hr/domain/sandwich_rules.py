"""Attendance sandwich (LOP on weekly offs / holidays).

Rule:
- If the working days that wrap an off/holiday are covered by **approved leave**,
  sandwich is **not** applied (the off stays a paid week-off/holiday).
- Otherwise sandwich **is** applied as LOP, even when the employee still has
  unused leave balance (balance is not auto-consumed; they must apply & get
  approval to avoid sandwich).

Leave request day counts stay working-days only. Sandwich is attendance LOP,
not extra leave deduction.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, timedelta

PAID_WORKING_STATUSES = frozenset(
    {
        "present",
        "late",
        "on_duty",
        "work_from_home",
        "half_day",
        "miss_punch",
    }
)
UNAUTHORIZED_STATUSES = frozenset({"absent"})

SANDWICH_NOTE_PREFIX = "auto-sandwich-lop"


def iter_dates_inclusive(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def is_unauthorized_flank(
    *,
    attendance_status: str | None,
    has_approved_leave: bool,
) -> bool:
    """True when a working day is an unauthorized absence (no approved leave)."""
    if has_approved_leave:
        return False
    status = (attendance_status or "").strip().lower()
    if status in PAID_WORKING_STATUSES:
        return False
    if status in {"holiday", "week_off"}:
        return False
    return status in UNAUTHORIZED_STATUSES or not status


def previous_working_day(
    day: date,
    is_non_working: Callable[[date], bool],
    *,
    limit: int = 14,
) -> date | None:
    cur = day - timedelta(days=1)
    for _ in range(limit):
        if not is_non_working(cur):
            return cur
        cur -= timedelta(days=1)
    return None


def next_working_day(
    day: date,
    is_non_working: Callable[[date], bool],
    *,
    limit: int = 14,
) -> date | None:
    cur = day + timedelta(days=1)
    for _ in range(limit):
        if not is_non_working(cur):
            return cur
        cur += timedelta(days=1)
    return None


def contiguous_off_blocks(
    start: date,
    end: date,
    is_non_working: Callable[[date], bool],
):
    """Yield (off_dates, previous_working, next_working) for each off/holiday run."""
    cur = start
    while cur <= end:
        if not is_non_working(cur):
            cur += timedelta(days=1)
            continue
        block: list[date] = []
        while cur <= end and is_non_working(cur):
            block.append(cur)
            cur += timedelta(days=1)
        prev_w = previous_working_day(block[0], is_non_working)
        next_w = next_working_day(block[-1], is_non_working)
        yield block, prev_w, next_w


def sandwich_lop_dates(
    start: date,
    end: date,
    *,
    is_non_working: Callable[[date], bool],
    attendance_status_by_date: dict[date, str],
    approved_leave_dates: set[date],
    as_of: date | None = None,
) -> set[date]:
    """Return off/holiday dates that should become LOP under the sandwich rule.

    ``as_of`` skips blocks whose next working day is still in the future
    (Friday+Monday sandwich cannot be decided on Saturday).
    """
    out: set[date] = set()
    for block, prev_w, next_w in contiguous_off_blocks(start, end, is_non_working):
        if prev_w is None or next_w is None:
            continue
        if as_of is not None and next_w > as_of:
            continue
        prev_unauth = is_unauthorized_flank(
            attendance_status=attendance_status_by_date.get(prev_w),
            has_approved_leave=prev_w in approved_leave_dates,
        )
        next_unauth = is_unauthorized_flank(
            attendance_status=attendance_status_by_date.get(next_w),
            has_approved_leave=next_w in approved_leave_dates,
        )
        if prev_unauth and next_unauth:
            out.update(block)
    return out


def sandwich_marker(original_status: str) -> str:
    kind = original_status if original_status in {"week_off", "holiday"} else "week_off"
    return f"{SANDWICH_NOTE_PREFIX}:{kind}"


def parse_sandwich_original(notes: str | None) -> str | None:
    if not notes:
        return None
    for part in notes.split("|"):
        token = part.strip()
        if token.startswith(f"{SANDWICH_NOTE_PREFIX}:"):
            kind = token.split(":", 1)[1].strip()
            return kind if kind in {"week_off", "holiday"} else "week_off"
        if token == SANDWICH_NOTE_PREFIX:
            return "week_off"
    return None


def append_sandwich_note(notes: str | None, original_status: str) -> str:
    marker = sandwich_marker(original_status)
    if notes and SANDWICH_NOTE_PREFIX in notes:
        return notes
    return f"{notes} | {marker}".strip(" |") if notes else marker


def strip_sandwich_note(notes: str | None) -> str | None:
    if not notes:
        return None
    kept = [
        part.strip()
        for part in notes.split("|")
        if part.strip() and not part.strip().startswith(SANDWICH_NOTE_PREFIX)
    ]
    return " | ".join(kept) or None
