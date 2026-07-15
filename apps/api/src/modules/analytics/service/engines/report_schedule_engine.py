"""ReportSchedule lifecycle engine."""

from modules.analytics.domain.enums import (
    ReportScheduleStatus,
)


class ReportScheduleEngine:
    def pause(self, row) -> None:
        row.status = ReportScheduleStatus.PAUSED.value
        row.is_enabled = False

    def activate(self, row) -> None:
        row.status = ReportScheduleStatus.ACTIVE.value
        row.is_enabled = True

    def retire(self, row) -> None:
        row.status = ReportScheduleStatus.RETIRED.value
        row.is_enabled = False
