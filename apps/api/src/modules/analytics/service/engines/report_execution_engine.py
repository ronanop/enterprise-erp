"""ReportExecution lifecycle engine."""

from modules.analytics.domain.enums import (
    ReportExecutionStatus,
)


class ReportExecutionEngine:
    def start(self, row) -> None:
        row.status = ReportExecutionStatus.RUNNING.value

    def succeed(self, row) -> None:
        row.status = ReportExecutionStatus.SUCCEEDED.value

    def fail(self, row) -> None:
        row.status = ReportExecutionStatus.FAILED.value

    def cancel(self, row) -> None:
        row.status = ReportExecutionStatus.CANCELLED.value
