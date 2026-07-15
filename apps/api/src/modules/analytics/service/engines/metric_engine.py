"""Metric lifecycle engine."""

from modules.analytics.domain.enums import (
    MetricStatus,
)


class MetricEngine:
    def activate(self, row) -> None:
        row.status = MetricStatus.ACTIVE.value

    def deprecate(self, row) -> None:
        row.status = MetricStatus.DEPRECATED.value
