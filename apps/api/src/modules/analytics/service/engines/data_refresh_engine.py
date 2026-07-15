"""DataRefresh lifecycle engine."""

from modules.analytics.domain.enums import (
    DataRefreshStatus,
)
from modules.analytics.domain.exceptions import (
    InvalidDataRefreshState,
)


class DataRefreshEngine:
    def submit(self, row) -> None:
        if row.status != DataRefreshStatus.DRAFT.value:
            raise InvalidDataRefreshState("Only draft refreshes can be submitted")
        row.status = DataRefreshStatus.SUBMITTED.value

    def queue(self, row) -> None:
        row.status = DataRefreshStatus.QUEUED.value

    def start(self, row) -> None:
        row.status = DataRefreshStatus.RUNNING.value

    def succeed(self, row) -> None:
        row.status = DataRefreshStatus.SUCCEEDED.value

    def fail(self, row) -> None:
        row.status = DataRefreshStatus.FAILED.value

    def cancel(self, row) -> None:
        row.status = DataRefreshStatus.CANCELLED.value
