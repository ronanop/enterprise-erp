"""Support ticket ORM per ERD_23 section 5.12."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtSupportTicket(Base, *PtRowMixin):
    __tablename__ = "pt_support_ticket"
    __table_args__ = (
        UniqueConstraint("company_id", "ticket_number", name="uk_pt_support_ticket_number"),
        CheckConstraint(
            "priority IN ('low','medium','high','urgent')",
            name="ck_pt_support_ticket_priority",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','open','in_progress','waiting','resolved','closed','cancelled')",
            name="ck_pt_support_ticket_status",
        ),
        Index("ix_pt_support_ticket_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    ticket_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")

    helpdesk_ticket_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    assigned_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
