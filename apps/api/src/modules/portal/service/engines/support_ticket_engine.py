"""SupportTicket lifecycle engine."""

from modules.portal.domain.enums import (
    SupportTicketStatus,
)
from modules.portal.domain.exceptions import (
    InvalidSupportTicketState,
)


class SupportTicketEngine:
    def submit(self, row) -> None:
        if row.status != SupportTicketStatus.DRAFT.value:
            raise InvalidSupportTicketState("Only draft tickets can be submitted")
        row.status = SupportTicketStatus.SUBMITTED.value
