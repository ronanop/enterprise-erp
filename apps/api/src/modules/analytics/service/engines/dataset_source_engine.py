"""DatasetSource lifecycle engine."""

from modules.analytics.domain.enums import (
    DatasetSourceStatus,
)


class DatasetSourceEngine:
    def activate(self, row) -> None:
        row.status = DatasetSourceStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = DatasetSourceStatus.INACTIVE.value
