"""Control lifecycle engine."""

from modules.grc.domain.enums import (
    ControlStatus,
)


class ControlEngine:
    def activate(self, row) -> None:
        row.status = ControlStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = ControlStatus.INACTIVE.value

    def retire(self, row) -> None:
        row.status = ControlStatus.RETIRED.value

