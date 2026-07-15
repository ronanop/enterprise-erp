"""Helpdesk domain entity markers."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class TicketIdentity:
    ticket_id: UUID
    document_number: str
    customer_id: UUID | None
