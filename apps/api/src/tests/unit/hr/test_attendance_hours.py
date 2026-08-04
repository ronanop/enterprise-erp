"""Unit tests for attendance hour calculation."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from modules.hr.service.engines.attendance_engine import compute_total_hours


def test_compute_total_hours_exact_eight() -> None:
    start = datetime(2026, 7, 27, 3, 30, tzinfo=timezone.utc)  # 09:00 IST
    end = datetime(2026, 7, 27, 11, 30, tzinfo=timezone.utc)  # 17:00 IST
    assert compute_total_hours(start, end) == Decimal("8.00")


def test_compute_total_hours_naive_check_in() -> None:
    start = datetime(2026, 7, 27, 9, 0, 0)  # naive → treated as UTC
    end = datetime(2026, 7, 27, 10, 30, tzinfo=timezone.utc)
    assert compute_total_hours(start, end) == Decimal("1.50")


def test_compute_total_hours_never_negative() -> None:
    start = datetime(2026, 7, 27, 12, 0, tzinfo=timezone.utc)
    end = datetime(2026, 7, 27, 11, 0, tzinfo=timezone.utc)
    assert compute_total_hours(start, end) == Decimal("0.00")


def test_compute_total_hours_partial_minutes() -> None:
    start = datetime(2026, 7, 27, 9, 0, tzinfo=timezone.utc)
    end = start + timedelta(minutes=45)
    assert compute_total_hours(start, end) == Decimal("0.75")
