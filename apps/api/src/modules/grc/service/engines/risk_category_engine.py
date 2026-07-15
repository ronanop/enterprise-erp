"""RiskCategory lifecycle engine."""

from modules.grc.domain.enums import (
    RiskCategoryStatus,
)


class RiskCategoryEngine:
    def activate(self, row) -> None:
        row.status = RiskCategoryStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = RiskCategoryStatus.INACTIVE.value

