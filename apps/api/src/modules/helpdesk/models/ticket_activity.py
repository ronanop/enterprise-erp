"""Ticket activity ORM per ERD_17 section 6.8."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdTicketActivity(Base, *HdDetailMixin):
    __tablename__ = "hd_ticket_activity"
    __table_args__ = (
        CheckConstraint("status IN ('recorded')", name="ck_hd_ticket_activity_status"),
        {"schema": "helpdesk"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    activity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    actor_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)
