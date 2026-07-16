"""PortalReport lifecycle engine."""

from modules.portal.domain.enums import (
    PortalReportStatus,
)


class PortalReportEngine:
    def finalize(self, row) -> None:
        row.status = PortalReportStatus.FINALIZED.value
