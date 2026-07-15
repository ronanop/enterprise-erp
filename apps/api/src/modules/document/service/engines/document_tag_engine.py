"""DocumentTag lifecycle engine."""

from modules.document.domain.enums import (
    DocumentTagStatus,
)


class DocumentTagEngine:
    def activate(self, row) -> None:
        row.status = DocumentTagStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = DocumentTagStatus.INACTIVE.value

