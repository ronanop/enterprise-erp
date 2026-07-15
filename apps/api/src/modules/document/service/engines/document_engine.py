"""Document lifecycle engine."""

from modules.document.domain.enums import (
    DocumentStatus,
)
from modules.document.domain.exceptions import (
    InvalidDocumentState,
)


class DocumentEngine:
    def submit(self, row) -> None:
        if row.status != DocumentStatus.DRAFT.value:
            raise InvalidDocumentState("Only draft documents can be submitted")
        row.status = DocumentStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != DocumentStatus.SUBMITTED.value:
            raise InvalidDocumentState("Only submitted documents can be approved")
        row.status = DocumentStatus.APPROVED.value

    def publish(self, row) -> None:
        if row.status != DocumentStatus.APPROVED.value:
            raise InvalidDocumentState("Only approved documents can be published")
        row.status = DocumentStatus.PUBLISHED.value

    def check_out(self, row) -> None:
        if row.status != DocumentStatus.PUBLISHED.value:
            raise InvalidDocumentState("Only published documents can check out")
        row.status = DocumentStatus.CHECKED_OUT.value

    def archive(self, row) -> None:
        row.status = DocumentStatus.ARCHIVED.value

    def cancel(self, row) -> None:
        row.status = DocumentStatus.CANCELLED.value

