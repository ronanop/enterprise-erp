"""DashboardWidget lifecycle engine."""

from modules.portal.domain.enums import (
    DashboardWidgetStatus,
)


class DashboardWidgetEngine:
    def hide(self, row) -> None:
        row.status = DashboardWidgetStatus.HIDDEN.value

    def show(self, row) -> None:
        row.status = DashboardWidgetStatus.ACTIVE.value
