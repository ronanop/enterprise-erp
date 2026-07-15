"""Report lifecycle engine."""

from modules.document.domain.enums import (
    ReportStatus,
)


class ReportEngine:
    def finalize(self, row) -> None:
        row.status = ReportStatus.FINALIZED.value

