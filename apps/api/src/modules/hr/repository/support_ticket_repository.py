"""HR employee support ticket repository."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.hr_support_ticket import HrSupportTicket, HrSupportTicketComment
from modules.hr.repository.base import HrScopedRepository


class SupportTicketRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ticket_id: UUID) -> HrSupportTicket | None:
        row = self.db.get(HrSupportTicket, ticket_id)
        if row is None or row.is_deleted:
            return None
        return row

    def list_for_requester(
        self,
        tenant_id: UUID,
        company_id: UUID,
        employee_id: UUID,
        *,
        limit: int = 100,
    ) -> list[HrSupportTicket]:
        stmt = (
            select(HrSupportTicket)
            .where(
                HrSupportTicket.tenant_id == tenant_id,
                HrSupportTicket.company_id == company_id,
                HrSupportTicket.requester_employee_id == employee_id,
                HrSupportTicket.is_deleted.is_(False),
            )
            .order_by(HrSupportTicket.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def list_comments(self, ticket_id: UUID) -> list[HrSupportTicketComment]:
        stmt = (
            select(HrSupportTicketComment)
            .where(
                HrSupportTicketComment.ticket_id == ticket_id,
                HrSupportTicketComment.is_deleted.is_(False),
            )
            .order_by(HrSupportTicketComment.commented_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        requester_employee_id: UUID,
        subject: str,
        description: str | None,
        kind: str,
        urgency: str | None,
        asset_id: UUID | None,
        opened_at: datetime,
    ) -> HrSupportTicket:
        row = HrSupportTicket(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            document_number=f"ESS-{uuid4().hex[:10].upper()}",
            requester_employee_id=requester_employee_id,
            subject=subject,
            description=description,
            kind=kind if kind in {"it", "asset", "grievance"} else "it",
            status="submitted",
            urgency=(urgency or "medium").lower()[:20],
            asset_id=asset_id,
            opened_at=opened_at,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def add_comment(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        ticket_id: UUID,
        author_employee_id: UUID,
        body: str,
        commented_at: datetime,
    ) -> HrSupportTicketComment:
        row = HrSupportTicketComment(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            ticket_id=ticket_id,
            author_employee_id=author_employee_id,
            body=body,
            commented_at=commented_at,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return row
