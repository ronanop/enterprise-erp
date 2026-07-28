"""Attendance lifecycle engine."""

from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from modules.hr.domain.enums import AttendanceRecordStatus
from modules.hr.domain.exceptions import InvalidAttendanceState


def _as_utc(value: datetime) -> datetime:
    """Normalize naive/aware datetimes to UTC for safe subtraction."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def compute_total_hours(check_in: datetime, check_out: datetime) -> Decimal:
    """Return worked hours (2 d.p.) between check-in and check-out."""
    start = _as_utc(check_in)
    end = _as_utc(check_out)
    seconds = max(0.0, (end - start).total_seconds())
    hours = Decimal(str(seconds)) / Decimal("3600")
    return hours.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class AttendanceEngine:
    def adjust(self, row) -> None:
        if row.status == AttendanceRecordStatus.LOCKED.value:
            raise InvalidAttendanceState("Locked attendance cannot be adjusted")
        row.status = AttendanceRecordStatus.ADJUSTED.value

    def lock(self, row) -> None:
        if row.status == AttendanceRecordStatus.LOCKED.value:
            raise InvalidAttendanceState("Attendance already locked")
        row.status = AttendanceRecordStatus.LOCKED.value

    def compute_hours(self, check_in: datetime, check_out: datetime) -> Decimal:
        return compute_total_hours(check_in, check_out)
