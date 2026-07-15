"""QueryHistory lifecycle engine."""

from modules.analytics.domain.enums import (
    QueryHistoryStatus,
)


class QueryHistoryEngine:
    def record(self, row) -> None:
        row.status = QueryHistoryStatus.RECORDED.value
