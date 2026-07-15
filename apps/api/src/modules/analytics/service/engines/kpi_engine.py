"""Kpi lifecycle engine."""

from modules.analytics.domain.enums import (
    KpiStatus,
)
from modules.analytics.domain.exceptions import (
    InvalidKpiState,
)


class KpiEngine:
    def submit(self, row) -> None:
        if row.status != KpiStatus.DRAFT.value:
            raise InvalidKpiState("Only draft KPIs can be submitted")
        row.status = KpiStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != KpiStatus.SUBMITTED.value:
            raise InvalidKpiState("Only submitted KPIs can be approved")
        row.status = KpiStatus.APPROVED.value

    def activate(self, row) -> None:
        row.status = KpiStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = KpiStatus.INACTIVE.value

    def cancel(self, row) -> None:
        row.status = KpiStatus.CANCELLED.value
