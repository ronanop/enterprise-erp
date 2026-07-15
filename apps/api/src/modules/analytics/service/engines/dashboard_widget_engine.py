"""DashboardWidget lifecycle engine."""

from modules.analytics.domain.enums import (
    DashboardWidgetStatus,
)


class DashboardWidgetEngine:
    def hide(self, row) -> None:
        row.status = DashboardWidgetStatus.HIDDEN.value

    def activate(self, row) -> None:
        row.status = DashboardWidgetStatus.ACTIVE.value

    def archive(self, row) -> None:
        row.status = DashboardWidgetStatus.ARCHIVED.value
