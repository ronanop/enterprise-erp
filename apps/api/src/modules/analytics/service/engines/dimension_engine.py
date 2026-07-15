"""Dimension lifecycle engine."""

from modules.analytics.domain.enums import (
    DimensionStatus,
)


class DimensionEngine:
    def activate(self, row) -> None:
        row.status = DimensionStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = DimensionStatus.INACTIVE.value
