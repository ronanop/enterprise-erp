"""PolicyVersion lifecycle engine."""

from modules.grc.domain.enums import (
    PolicyVersionStatus,
)


class PolicyVersionEngine:
    def publish(self, row) -> None:
        row.status = PolicyVersionStatus.PUBLISHED.value
        row.is_current = True

    def supersede(self, row) -> None:
        row.status = PolicyVersionStatus.SUPERSEDED.value
        row.is_current = False

