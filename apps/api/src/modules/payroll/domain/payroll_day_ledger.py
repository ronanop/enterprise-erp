"""Pure helpers for payroll period day counting (Phase 2)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable
from uuid import UUID


@dataclass(frozen=True)
class LeaveDayMarker:
    is_paid: bool
    leave_type_id: UUID | None = None


def iter_dates_inclusive(start: date, end: date) -> Iterable[date]:
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def calendar_days_in_period(start: date, end: date) -> int:
    return sum(1 for _ in iter_dates_inclusive(start, end))


def is_scheduled_working_day(
    *,
    on_date: date,
    is_holiday: bool,
    is_week_off: bool,
    roster_shift_id: str | None,
    roster_status: str | None,
) -> bool:
    """True when the day counts toward shift-scheduled denominator N."""
    if is_holiday or is_week_off:
        return False
    if roster_status == "cancelled":
        return False
    if roster_shift_id and roster_status == "published":
        return True
    # No published roster: count as scheduled working day (shift expected Mon–Fri etc. via weekly-off rules).
    return True


def count_scheduled_days(
    start: date,
    end: date,
    scheduled_flags: dict[date, bool],
) -> int:
    return sum(1 for d in iter_dates_inclusive(start, end) if scheduled_flags.get(d, False))


def expand_leave_markers(
    leave_requests: list[dict],
    period_start: date,
    period_end: date,
) -> dict[date, LeaveDayMarker]:
    """Map each calendar day in approved leave ranges to paid/unpaid."""
    markers: dict[date, LeaveDayMarker] = {}
    for lr in leave_requests:
        start = lr.get("start_date")
        end = lr.get("end_date")
        if start is None or end is None:
            continue
        is_paid = bool(lr.get("is_paid", True))
        type_id = lr.get("leave_type_id")
        clip_start = max(start, period_start)
        clip_end = min(end, period_end)
        if clip_start > clip_end:
            continue
        for d in iter_dates_inclusive(clip_start, clip_end):
            existing = markers.get(d)
            if existing is None:
                markers[d] = LeaveDayMarker(is_paid=is_paid, leave_type_id=type_id)
            elif existing.is_paid or is_paid:
                markers[d] = LeaveDayMarker(is_paid=True, leave_type_id=type_id or existing.leave_type_id)
            else:
                markers[d] = LeaveDayMarker(is_paid=False, leave_type_id=type_id or existing.leave_type_id)
    return markers


def scheduled_working_dates(
    start: date,
    end: date,
    *,
    is_scheduled_fn,
) -> list[date]:
    return [d for d in iter_dates_inclusive(start, end) if is_scheduled_fn(d)]


def resolve_lop_on_scheduled_days(
    scheduled_dates: list[date],
    attendance_by_date: dict[date, str],
    leave_by_date: dict[date, LeaveDayMarker],
    *,
    lop_statuses: set[str],
    half_lop_statuses: set[str],
    paid_attendance_statuses: set[str],
) -> tuple[Decimal, Decimal, Decimal]:
    """Returns (lop_days, paid_leave_days, unpaid_leave_days) on scheduled working days only."""
    lop = Decimal("0")
    paid_leave = Decimal("0")
    unpaid_leave = Decimal("0")

    for d in scheduled_dates:
        leave = leave_by_date.get(d)
        status = (attendance_by_date.get(d) or "").strip().lower()

        if leave is not None:
            if leave.is_paid:
                paid_leave += Decimal("1")
                continue
            unpaid_leave += Decimal("1")
            lop += Decimal("1")
            continue

        if status in lop_statuses:
            lop += Decimal("1")
        elif status in half_lop_statuses:
            lop += Decimal("0.5")
        elif status in paid_attendance_statuses or status in {"holiday", "week_off"}:
            continue
        elif status:
            continue

    return lop, paid_leave, unpaid_leave


def lop_from_attendance_records(
    records: list[dict],
    *,
    lop_statuses: set[str],
    half_lop_statuses: set[str],
) -> Decimal:
    total = Decimal("0")
    for record in records:
        status = (record.get("attendance_status") or "").strip().lower()
        if status in lop_statuses:
            total += Decimal("1")
        elif status in half_lop_statuses:
            total += Decimal("0.5")
    return total
