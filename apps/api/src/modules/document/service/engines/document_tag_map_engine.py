"""DocumentTagMap lifecycle engine."""

from modules.document.domain.enums import (
    DocumentTagMapStatus,
)


class DocumentTagMapEngine:
    def remove(self, row) -> None:
        row.status = DocumentTagMapStatus.REMOVED.value

