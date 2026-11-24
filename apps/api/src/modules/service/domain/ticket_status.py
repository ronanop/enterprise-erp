"""Ticket status presentation helpers (no ORM / framework imports)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

STATUS_LABELS: dict[str, str] = {
    "draft": "Draft",
    "ticket_registered": "Open",
    "new": "Open",
    "submitted": "Open",
    "approved": "Open",
    "awaiting_assignment": "Awaiting Assignment",
    "assigned": "Assigned",
    "engineer_working": "In Progress",
    "in_progress": "In Progress",
    "pending_customer": "Pending Customer",
    "pending_oem": "Pending OEM",
    "resolved": "Resolved",
    "closed": "Closed",
    "cancelled": "Cancelled",
}


def status_label(status: str | None, reopened_at: datetime | None = None) -> str:
    """Friendly status for UI. In-progress tickets that were reopened show 'Reopened'."""
    if not status:
        return ""
    key = status.strip().lower()
    if key in ("engineer_working", "in_progress") and reopened_at is not None:
        return "Reopened"
    label = STATUS_LABELS.get(key)
    if label:
        return label
    return key.replace("_", " ").title()


def add_working_minutes(
    start: datetime,
    minutes: int,
    *,
    day_start_hour: int = 9,
    day_end_hour: int = 18,
    utc_offset_minutes: int = 330,
) -> datetime:
    """Add working minutes (Mon-Fri, [day_start_hour, day_end_hour) local time) to ``start``.

    The return value is timezone-aware UTC. If ``start`` falls outside working hours the
    clock begins at the next working window.
    """
    if minutes < 0:
        raise ValueError("minutes must be >= 0")
    if day_end_hour <= day_start_hour:
        raise ValueError("day_end_hour must be after day_start_hour")
    tz = timezone(timedelta(minutes=utc_offset_minutes))
    cursor = (start if start.tzinfo else start.replace(tzinfo=timezone.utc)).astimezone(tz)
    remaining = int(minutes)

    def _window(day: datetime) -> tuple[datetime, datetime]:
        base = day.replace(hour=0, minute=0, second=0, microsecond=0)
        return base + timedelta(hours=day_start_hour), base + timedelta(hours=day_end_hour)

    # Normalise cursor into the next valid working instant
    while True:
        if cursor.weekday() >= 5:
            cursor = _window(cursor + timedelta(days=1))[0]
            continue
        w_start, w_end = _window(cursor)
        if cursor < w_start:
            cursor = w_start
        elif cursor >= w_end:
            cursor = _window(cursor + timedelta(days=1))[0]
            continue
        break

    while remaining > 0:
        if cursor.weekday() >= 5:
            cursor = _window(cursor + timedelta(days=1))[0]
            continue
        w_start, w_end = _window(cursor)
        if cursor < w_start:
            cursor = w_start
        if cursor >= w_end:
            cursor = _window(cursor + timedelta(days=1))[0]
            continue
        available = int((w_end - cursor).total_seconds() // 60)
        if remaining <= available:
            cursor = cursor + timedelta(minutes=remaining)
            remaining = 0
        else:
            remaining -= available
            cursor = _window(cursor + timedelta(days=1))[0]
    return cursor.astimezone(timezone.utc)
