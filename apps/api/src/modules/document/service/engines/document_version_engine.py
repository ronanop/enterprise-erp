"""DocumentVersion lifecycle engine."""

from modules.document.domain.enums import (
    DocumentVersionStatus,
)


class DocumentVersionEngine:
    def supersede(self, row) -> None:
        row.status = DocumentVersionStatus.SUPERSEDED.value
        row.is_current = False

    def soft_delete(self, row) -> None:
        row.status = DocumentVersionStatus.DELETED_SOFT.value

