"""OrderView lifecycle engine."""

from modules.portal.domain.enums import (
    OrderViewStatus,
)


class OrderViewEngine:
    def mark_stale(self, row) -> None:
        row.status = OrderViewStatus.STALE.value
