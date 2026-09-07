"""HR leave-adjust event ORM — per-day confirm history."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrLeaveAdjustEvent(Base, *HrTransactionMixin):
    __tablename__ = "hr_leave_adjust_event"
    __table_args__ = (
        CheckConstraint("result IN ('adjusted','lop')", name="ck_hr_ladj_evt_result"),
        CheckConstraint(
            "source IN ('attendance_tab','payroll_run')",
            name="ck_hr_ladj_evt_source",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    leave_type_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_leave_type.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    days: Mapped[Decimal] = mapped_column(Numeric(9, 2), nullable=False)
    result: Mapped[str] = mapped_column(String(20), nullable=False)
    balance_before: Mapped[Decimal | None] = mapped_column(Numeric(9, 2), nullable=True)
    balance_after: Mapped[Decimal | None] = mapped_column(Numeric(9, 2), nullable=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="attendance_tab")
    payroll_run_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    leave_request_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_leave_request.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    confirmed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reverted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
