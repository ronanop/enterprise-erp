"""Report lifecycle engine."""

from modules.analytics.domain.enums import (
    ReportStatus,
)
from modules.analytics.domain.exceptions import (
    InvalidReportState,
)


class ReportEngine:
    def submit(self, row) -> None:
        if row.status != ReportStatus.DRAFT.value:
            raise InvalidReportState("Only draft reports can be submitted")
        row.status = ReportStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != ReportStatus.SUBMITTED.value:
            raise InvalidReportState("Only submitted reports can be approved")
        row.status = ReportStatus.APPROVED.value

    def publish(self, row) -> None:
        if row.status != ReportStatus.APPROVED.value:
            raise InvalidReportState("Only approved reports can be published")
        row.status = ReportStatus.PUBLISHED.value

    def run(self, row) -> None:
        if row.status not in {
            ReportStatus.APPROVED.value,
            ReportStatus.PUBLISHED.value,
        }:
            raise InvalidReportState("Report must be approved or published to run")
