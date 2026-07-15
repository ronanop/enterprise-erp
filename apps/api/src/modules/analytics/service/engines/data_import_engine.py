"""DataImport lifecycle engine."""

from modules.analytics.domain.enums import (
    DataImportStatus,
)
from modules.analytics.domain.exceptions import (
    InvalidDataImportState,
)


class DataImportEngine:
    def run(self, row) -> None:
        if row.status not in {
            DataImportStatus.QUEUED.value,
            DataImportStatus.FAILED.value,
        }:
            raise InvalidDataImportState("Import not runnable")
        row.status = DataImportStatus.RUNNING.value

    def succeed(self, row) -> None:
        row.status = DataImportStatus.SUCCEEDED.value

    def fail(self, row) -> None:
        row.status = DataImportStatus.FAILED.value

    def cancel(self, row) -> None:
        row.status = DataImportStatus.CANCELLED.value
