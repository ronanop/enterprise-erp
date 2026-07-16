"""DownloadHistory lifecycle engine."""

from modules.portal.domain.enums import (
    DownloadHistoryStatus,
)


class DownloadHistoryEngine:
    def record(self, row) -> None:
        row.status = DownloadHistoryStatus.RECORDED.value
