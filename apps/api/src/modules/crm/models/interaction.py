"""CRM interaction ORM."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmTransactionMixin


class CrmInteraction(Base, *CrmTransactionMixin):
    __tablename__ = "crm_interaction"
    __table_args__ = (
        UniqueConstraint("company_id", "interaction_code", name="uk_crm_int_company_code"),
        CheckConstraint(
            "status IN ('open','completed')",
            name="ck_crm_int_status",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    interaction_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    interaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    interaction_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lead_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_lead.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    opportunity_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_opportunity.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    channel: Mapped[str | None] = mapped_column(String(30), nullable=True)
    direction: Mapped[str | None] = mapped_column(String(20), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    call_log_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    email_log_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    meeting_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    visit_log_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
