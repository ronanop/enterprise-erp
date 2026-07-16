"""InvoiceView lifecycle engine."""

from modules.portal.domain.enums import (
    InvoiceViewStatus,
)


class InvoiceViewEngine:
    def mark_stale(self, row) -> None:
        row.status = InvoiceViewStatus.STALE.value
