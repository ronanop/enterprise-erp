"""Helpdesk port — UUID-only stubs; no hd_* FK / ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalHelpdeskAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_ticket_ref(self, ctx: TenantContext, helpdesk_ticket_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return helpdesk_ticket_id
