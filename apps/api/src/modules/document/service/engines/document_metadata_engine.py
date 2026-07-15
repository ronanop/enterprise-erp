"""DocumentMetadata lifecycle engine."""

from modules.document.domain.enums import (
    DocumentMetadataStatus,
)


class DocumentMetadataEngine:
    def activate(self, row) -> None:
        row.status = DocumentMetadataStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = DocumentMetadataStatus.INACTIVE.value

