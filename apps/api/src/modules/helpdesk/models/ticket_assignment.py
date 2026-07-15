"""Ticket assignment ORM per ERD_17 section 6.4."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdTransactionMixin


class HdTicketAssignment(Base, *HdTransactionMixin):
    __tablename__ = "hd_ticket_assignment"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_ticket_assignment_doc"),
        CheckConstraint(
            "role_on_ticket IN ('primary','secondary','watcher')",
            name="ck_hd_ticket_assignment_role",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','completed','cancelled')",
            name="ck_hd_ticket_assignment_status",
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
    assignee_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    support_team_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "helpdesk.hd_support_team.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_hd_assignment_support_team",
        ),
        nullable=True,
        index=True,
    )
    role_on_ticket: Mapped[str] = mapped_column(String(30), nullable=False, default="primary")
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unassigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
