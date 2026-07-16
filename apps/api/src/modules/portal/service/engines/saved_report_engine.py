"""SavedReport lifecycle engine."""

from modules.portal.domain.enums import (
    SavedReportStatus,
)


class SavedReportEngine:
    def archive(self, row) -> None:
        row.status = SavedReportStatus.ARCHIVED.value
