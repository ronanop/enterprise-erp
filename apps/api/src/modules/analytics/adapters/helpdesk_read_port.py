"""Helpdesk read adapter — analytical consumption only."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.helpdesk.models.ticket import HdTicket


class AnalyticsHelpdeskReadAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def ticket_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(HdTicket.status, func.count())
            .where(
                HdTicket.tenant_id == ctx.tenant_id,
                HdTicket.company_id == company_id,
                HdTicket.is_deleted.is_(False),
                HdTicket.status != "cancelled",
            )
            .group_by(HdTicket.status)
        ).all()
        breakdown = [{"dimension_label": status, "value": int(count)} for status, count in rows]
        return sum(item["value"] for item in breakdown), breakdown

    def open_ticket_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(HdTicket.ticket_type, func.count())
            .where(
                HdTicket.tenant_id == ctx.tenant_id,
                HdTicket.company_id == company_id,
                HdTicket.is_deleted.is_(False),
                HdTicket.status.notin_(("resolved", "closed", "cancelled")),
            )
            .group_by(HdTicket.ticket_type)
        ).all()
        breakdown = [{"dimension_label": ticket_type, "value": int(count)} for ticket_type, count in rows]
        return sum(item["value"] for item in breakdown), breakdown

    def incident_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(HdTicket.status, func.count())
            .where(
                HdTicket.tenant_id == ctx.tenant_id,
                HdTicket.company_id == company_id,
                HdTicket.is_deleted.is_(False),
                HdTicket.ticket_type == "incident",
                HdTicket.status != "cancelled",
            )
            .group_by(HdTicket.status)
        ).all()
        breakdown = [{"dimension_label": status, "value": int(count)} for status, count in rows]
        return sum(item["value"] for item in breakdown), breakdown
