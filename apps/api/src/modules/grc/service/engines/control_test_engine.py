"""ControlTest lifecycle engine."""

from modules.grc.domain.enums import (
    ControlTestStatus,
)


class ControlTestEngine:
    def complete(self, row) -> None:
        row.status = ControlTestStatus.COMPLETED.value

    def archive(self, row) -> None:
        row.status = ControlTestStatus.ARCHIVED.value

