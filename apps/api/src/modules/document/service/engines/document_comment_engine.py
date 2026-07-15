"""DocumentComment lifecycle engine."""

from modules.document.domain.enums import (
    DocumentCommentStatus,
)


class DocumentCommentEngine:
    def soft_delete(self, row) -> None:
        if row.status != DocumentCommentStatus.ACTIVE.value:
            raise ValueError("Only active comments can soft-delete")
        row.status = DocumentCommentStatus.DELETED_SOFT.value

