"""CRM lead activity ORM."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmDetailMixin


class CrmLeadActivity(Base, *CrmDetailMixin):
    __tablename__ = "crm_lead_activity"
    __table_args__ = (
        CheckConstraint(
            "activity_type IN ('call','meeting','email','task','follow_up','note')",
            name="ck_crm_lact_type",
        ),
        CheckConstraint(
            "status IN ('planned','completed','cancelled')",
            name="ck_crm_lact_status",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    lead_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_lead.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    activity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    related_meeting_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    related_task_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="planned", index=True)
