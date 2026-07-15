"""DataExport lifecycle engine."""

from modules.analytics.domain.enums import (
    DataExportStatus,
)
from modules.analytics.domain.exceptions import (
    InvalidDataExportState,
)


class DataExportEngine:
    def run(self, row) -> None:
        if row.status not in {
            DataExportStatus.QUEUED.value,
            DataExportStatus.FAILED.value,
        }:
            raise InvalidDataExportState("Export not runnable")
        row.status = DataExportStatus.RUNNING.value

    def succeed(self, row) -> None:
        row.status = DataExportStatus.SUCCEEDED.value

    def fail(self, row) -> None:
        row.status = DataExportStatus.FAILED.value

    def expire(self, row) -> None:
        row.status = DataExportStatus.EXPIRED.value
