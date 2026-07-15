"""Helpdesk port — UUID-only stubs; no hd_* FK / ORM writes."""

from uuid import UUID


class GrcHelpdeskAdapter:
    def resolve_ticket_uuid(self, helpdesk_ticket_id: UUID | None) -> UUID | None:
        return helpdesk_ticket_id
