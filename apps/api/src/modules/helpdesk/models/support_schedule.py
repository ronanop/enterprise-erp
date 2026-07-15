"""Support schedule ORM per ERD_17 section 6.17."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdTransactionMixin


class HdSupportSchedule(Base, *HdTransactionMixin):
    __tablename__ = "hd_support_schedule"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_support_schedule_doc"),
        CheckConstraint(
            "status IN ('planned','confirmed','completed','cancelled')",
            name="ck_hd_support_schedule_status",
        ),
        {"schema": "helpdesk"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    support_team_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_support_team.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    support_shift_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_support_shift.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    planned_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    planned_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="planned", index=True)
