"""Ticket escalation ORM per ERD_17 section 6.10."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdTransactionMixin


class HdTicketEscalation(Base, *HdTransactionMixin):
    __tablename__ = "hd_ticket_escalation"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_ticket_escalation_doc"),
        CheckConstraint(
            "reason_code IN ('sla_at_risk','sla_breached','customer_complaint','management')",
            name="ck_hd_ticket_escalation_reason",
        ),
        CheckConstraint(
            "status IN ('open','acknowledged','resolved','cancelled')",
            name="ck_hd_ticket_escalation_status",
        ),
        {"schema": "helpdesk"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sla_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_sla.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    escalation_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    reason_code: Mapped[str] = mapped_column(String(40), nullable=False)
    escalated_to_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    escalated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
