"""Ticket notification ORM per ERD_17 section 6.18."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdTicketNotification(Base, *HdDetailMixin):
    __tablename__ = "hd_ticket_notification"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','archived')",
            name="ck_hd_ticket_notification_status",
        ),
        {"schema": "helpdesk"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    ticket_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False)
    recipient_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    recipient_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recipient_customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
