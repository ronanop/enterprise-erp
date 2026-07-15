"""DocumentShare lifecycle engine."""

from modules.document.domain.enums import (
    DocumentShareStatus,
)


class DocumentShareEngine:
    def revoke(self, row) -> None:
        row.status = DocumentShareStatus.REVOKED.value

    def expire(self, row) -> None:
        row.status = DocumentShareStatus.EXPIRED.value

