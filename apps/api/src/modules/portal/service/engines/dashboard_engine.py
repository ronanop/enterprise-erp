"""Dashboard lifecycle engine."""

from modules.portal.domain.enums import (
    DashboardStatus,
)


class DashboardEngine:
    def activate(self, row) -> None:
        row.status = DashboardStatus.ACTIVE.value

    def archive(self, row) -> None:
        row.status = DashboardStatus.ARCHIVED.value
