"""DocumentCheckout lifecycle engine."""

from modules.document.domain.enums import (
    DocumentCheckoutStatus,
)
from modules.document.domain.exceptions import (
    InvalidDocumentCheckoutState,
)


class DocumentCheckoutEngine:
    def submit(self, row) -> None:
        if row.status != DocumentCheckoutStatus.DRAFT.value:
            raise InvalidDocumentCheckoutState("Only draft checkouts can be submitted")
        row.status = DocumentCheckoutStatus.SUBMITTED.value

    def activate(self, row) -> None:
        if row.status not in {
            DocumentCheckoutStatus.DRAFT.value,
            DocumentCheckoutStatus.SUBMITTED.value,
        }:
            raise InvalidDocumentCheckoutState("Checkout not activatable")
        row.status = DocumentCheckoutStatus.ACTIVE.value

    def complete(self, row) -> None:
        if row.status == DocumentCheckoutStatus.SUBMITTED.value:
            row.status = DocumentCheckoutStatus.ACTIVE.value
        if row.status != DocumentCheckoutStatus.ACTIVE.value:
            raise InvalidDocumentCheckoutState("Only active checkouts can complete")
        row.status = DocumentCheckoutStatus.COMPLETED.value

    def checkin(self, row) -> None:
        self.complete(row)

    def cancel(self, row) -> None:
        row.status = DocumentCheckoutStatus.CANCELLED.value

