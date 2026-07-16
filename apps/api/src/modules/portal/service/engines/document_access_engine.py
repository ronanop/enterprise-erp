"""DocumentAccess lifecycle engine."""

from modules.portal.domain.enums import (
    DocumentAccessStatus,
)
from modules.portal.domain.exceptions import (
    InvalidDocumentAccessState,
)


class DocumentAccessEngine:
    def submit(self, row) -> None:
        if row.status != DocumentAccessStatus.DRAFT.value:
            raise InvalidDocumentAccessState("Only draft access grants can be submitted")
        row.status = DocumentAccessStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != DocumentAccessStatus.SUBMITTED.value:
            raise InvalidDocumentAccessState("Only submitted access grants can be approved")
        row.status = DocumentAccessStatus.APPROVED.value

    def revoke(self, row) -> None:
        row.status = DocumentAccessStatus.REVOKED.value
