"""Support-ticket port for ESS (hr schema)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.hr_support_ticket import HrSupportTicket, HrSupportTicketComment
from modules.hr.repository.support_ticket_repository import SupportTicketRepository


class EssHelpdeskAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = SupportTicketRepository(db)

    def list_requester_tickets(
        self, ctx: TenantContext, *, company_id: UUID, employee_id: UUID, limit: int = 100
    ) -> list[HrSupportTicket]:
        return self._repo.list_for_requester(
            ctx.tenant_id, company_id, employee_id, limit=limit
        )

    def get_ticket(self, ticket_id: UUID) -> HrSupportTicket | None:
        return self._repo.get(ticket_id)

    def list_comments(self, ticket_id: UUID) -> list[HrSupportTicketComment]:
        return self._repo.list_comments(ticket_id)

    def create_ticket(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID | None,
        requester_employee_id: UUID,
        subject: str,
        description: str | None,
        kind: str,
        urgency: str | None,
        asset_id: UUID | None,
    ) -> HrSupportTicket:
        if branch_id is None:
            raise ValueError("branch_id is required")
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            requester_employee_id=requester_employee_id,
            subject=subject,
            description=description,
            kind=kind,
            urgency=urgency,
            asset_id=asset_id,
            opened_at=datetime.now(timezone.utc),
        )

    def add_comment(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        ticket_id: UUID,
        author_employee_id: UUID,
        body: str,
    ) -> HrSupportTicketComment:
        ticket = self._repo.get(ticket_id)
        if ticket is None:
            raise ValueError("ticket not found")
        return self._repo.add_comment(
            ctx,
            company_id=company_id,
            branch_id=ticket.branch_id,
            ticket_id=ticket_id,
            author_employee_id=author_employee_id,
            body=body,
            commented_at=datetime.now(timezone.utc),
        )
