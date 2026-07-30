"""HR attendance ORM."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrAttendance(Base, *HrTransactionMixin):
    __tablename__ = "hr_attendance"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "employee_id",
            "attendance_date",
            name="uk_hr_att_emp_date",
        ),
        CheckConstraint(
            "attendance_status IN ('present','absent','half_day','work_from_home',"
            "'holiday','late','week_off','on_duty','miss_punch')",
            name="ck_hr_att_day_status",
        ),
        CheckConstraint(
            "source IN ('manual','biometric','mobile','web','device')",
            name="ck_hr_att_source",
        ),
        CheckConstraint(
            "status IN ('recorded','adjusted','locked')",
            name="ck_hr_att_status",
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
    check_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    check_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_hours: Mapped[Decimal | None] = mapped_column(Numeric(9, 2), nullable=True)
    attendance_status: Mapped[str] = mapped_column(String(30), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="manual")
    shift_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_shift.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    late_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overtime_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    early_leave_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
