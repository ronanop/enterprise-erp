"""FactTable lifecycle engine."""

from modules.analytics.domain.enums import (
    FactTableStatus,
)


class FactTableEngine:
    def activate(self, row) -> None:
        row.status = FactTableStatus.ACTIVE.value

    def rebuild(self, row) -> None:
        row.status = FactTableStatus.REBUILDING.value

    def retire(self, row) -> None:
        row.status = FactTableStatus.RETIRED.value
