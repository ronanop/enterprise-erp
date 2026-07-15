"""DataSnapshot lifecycle engine."""

from modules.analytics.domain.enums import (
    DataSnapshotStatus,
)


class DataSnapshotEngine:
    def expire(self, row) -> None:
        row.status = DataSnapshotStatus.EXPIRED.value

    def mark_failed(self, row) -> None:
        row.status = DataSnapshotStatus.FAILED.value
