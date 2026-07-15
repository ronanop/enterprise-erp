"""Dashboard lifecycle engine."""

from modules.analytics.domain.enums import (
    DashboardStatus,
)
from modules.analytics.domain.exceptions import (
    InvalidDashboardState,
)


class DashboardEngine:
    def submit(self, row) -> None:
        if row.status != DashboardStatus.DRAFT.value:
            raise InvalidDashboardState("Only draft dashboards can be submitted")
        row.status = DashboardStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != DashboardStatus.SUBMITTED.value:
            raise InvalidDashboardState("Only submitted dashboards can be approved")
        row.status = DashboardStatus.APPROVED.value

    def publish(self, row) -> None:
        if row.status != DashboardStatus.APPROVED.value:
            raise InvalidDashboardState("Only approved dashboards can be published")
        row.status = DashboardStatus.PUBLISHED.value

    def archive(self, row) -> None:
        row.status = DashboardStatus.ARCHIVED.value

    def cancel(self, row) -> None:
        row.status = DashboardStatus.CANCELLED.value
