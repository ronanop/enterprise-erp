"""DocumentAttachment lifecycle engine."""

from modules.document.domain.enums import (
    DocumentAttachmentStatus,
)


class DocumentAttachmentEngine:
    def supersede(self, row) -> None:
        row.status = DocumentAttachmentStatus.SUPERSEDED.value

    def archive(self, row) -> None:
        row.status = DocumentAttachmentStatus.ARCHIVED.value

