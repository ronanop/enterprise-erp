"""DocumentApproval lifecycle engine."""

from modules.document.domain.enums import (
    DocumentApprovalStatus,
)
from modules.document.domain.exceptions import (
    InvalidDocumentApprovalState,
)


class DocumentApprovalEngine:
    def submit(self, row) -> None:
        if row.status != DocumentApprovalStatus.DRAFT.value:
            raise InvalidDocumentApprovalState("Only draft approvals can be submitted")
        row.status = DocumentApprovalStatus.SUBMITTED.value

    def complete(self, row) -> None:
        if row.status != DocumentApprovalStatus.SUBMITTED.value:
            raise InvalidDocumentApprovalState("Only submitted approvals can complete")
        row.status = DocumentApprovalStatus.COMPLETED.value

    def cancel(self, row) -> None:
        row.status = DocumentApprovalStatus.CANCELLED.value

