"""Employee support tickets and comments (standalone HRMS, hr schema)."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrSupportTicket(Base, *HrTransactionMixin):
    __tablename__ = "hr_support_ticket"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hr_ticket_company_doc"),
        CheckConstraint(
            "kind IN ('it','asset','grievance')",
            name="ck_hr_ticket_kind",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','open','resolved','closed','cancelled')",
            name="ck_hr_ticket_status",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    requester_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="it")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="submitted", index=True)
    urgency: Mapped[str | None] = mapped_column(String(20), nullable=True)
    asset_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_employee_asset.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class HrSupportTicketComment(Base, *HrTransactionMixin):
    __tablename__ = "hr_support_ticket_comment"
    __table_args__ = ({"schema": "hr"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_support_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    commented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
